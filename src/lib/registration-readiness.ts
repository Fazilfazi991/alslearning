export type RegistrationBatch = {
  id: string;
  programId: string;
  status: string;
  batchCode: string | null;
  maxStudents: number | null;
  reservedSeats: number;
  approvedDefault: boolean;
};

export type RegistrationReadinessInput = {
  status: "pending" | "ready_for_approval" | "needs_information" | "approved" | "rejected";
  programId: string;
  programActive: boolean;
  selectedBatchId: string | null;
  batches: RegistrationBatch[];
  missingFields: string[];
  identityConflict: boolean;
};

/** Presentation-only preflight. Approval must recheck every condition atomically in the database. */
export function registrationReadiness(input: RegistrationReadinessInput) {
  const eligible = (batch: RegistrationBatch) => batch.programId === input.programId && batch.status === "active" && Boolean(batch.batchCode) && Number.isSafeInteger(batch.reservedSeats) && batch.reservedSeats >= 0 && (batch.maxStudents === null || (Number.isSafeInteger(batch.maxStudents) && batch.reservedSeats < batch.maxStudents));
  const defaults = input.batches.filter(batch => batch.approvedDefault && eligible(batch));
  const proposedBatchId = input.programActive && defaults.length === 1 ? defaults[0].id : null;
  const selectedBatch = input.selectedBatchId ? input.batches.find(batch => batch.id === input.selectedBatchId) : undefined;
  const reasons = [...input.missingFields.map(field => `Missing ${field}.`)];
  if (input.status === "needs_information") reasons.push("Resolve the information request before approval.");
  if (input.status === "approved" || input.status === "rejected") reasons.push("This application has already been decided.");
  if (!input.programActive) reasons.push("The selected program is not active.");
  if (input.identityConflict) reasons.push("An existing identity needs review before approval.");
  if (!selectedBatch) reasons.push("Choose a compatible batch.");
  else if (!eligible(selectedBatch)) reasons.push("The selected batch is unavailable, full, or incompatible.");
  return { proposedBatchId, ready: reasons.length === 0, reasons };
}
