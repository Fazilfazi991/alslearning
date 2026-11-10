import { validAccountEmail, validAccountId } from "./account-validation";

export type RegistrationApplication = {
  fullName: string;
  email: string;
  phone: string;
  qualification: string;
  institution: string;
  programId: string;
  preferredBatchId: string | null;
  notes: string | null;
  consent: true;
  requestId: string;
};

const fields = new Set(["fullName", "email", "phone", "qualification", "institution", "programId", "preferredBatchId", "notes", "consent", "requestId", "website"]);

/** Shared validation is repeated at the trusted server boundary. */
export function validateRegistration(body: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const read = (name: string) => typeof body[name] === "string" ? (body[name] as string).trim() : "";
  const fullName = read("fullName"), email = read("email").toLowerCase();
  const phone = read("phone").replace(/[\s().-]/g, "");
  const qualification = read("qualification"), institution = read("institution");
  const programId = read("programId"), preferredBatchId = read("preferredBatchId"), notes = read("notes"), requestId = read("requestId");
  if (Object.keys(body).some(key => !fields.has(key))) errors.form = "The application contains an unsupported field.";
  if (fullName.length < 2 || fullName.length > 120) errors.fullName = "Enter your full name (2–120 characters).";
  if (!validAccountEmail(email)) errors.email = "Enter a valid email address.";
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) errors.phone = "Include your country code, for example +91 98765 43210.";
  if (qualification.length < 2 || qualification.length > 160) errors.qualification = "Enter your qualification (2–160 characters).";
  if (institution.length < 2 || institution.length > 200) errors.institution = "Enter your institution (2–200 characters).";
  if (!validAccountId(programId)) errors.programId = "Choose an available program.";
  if (body.preferredBatchId != null && body.preferredBatchId !== "" && (typeof body.preferredBatchId !== "string" || !validAccountId(preferredBatchId))) errors.preferredBatchId = "Choose an available batch or leave this blank.";
  if (body.notes != null && typeof body.notes !== "string") errors.notes = "Enter your additional information as text.";
  else if (notes.length > 2000) errors.notes = "Use up to 2,000 characters.";
  if (body.consent !== true) errors.consent = "Please consent to ALS processing your application and contacting you.";
  if (!validAccountId(requestId)) errors.requestId = "Refresh the page and try again.";
  const value: RegistrationApplication = { fullName, email, phone, qualification, institution, programId, preferredBatchId: preferredBatchId || null, notes: notes || null, consent: true, requestId };
  return { errors, value: Object.keys(errors).length === 0 ? value : null };
}
