import { randomUUID } from "node:crypto";

// Operational alert only: logging retention and session-specific reconciliation
// are not guaranteed. Never include tokens, email addresses, or passwords.
export function recordUncertainRegistrationRevocation(userId: string) {
  console.error(JSON.stringify({ event: "registration_session_revocation_uncertain", correlation_id: randomUUID(), user_id: userId, occurred_at: new Date().toISOString() }));
}

export function recordUncertainRegistrationPasswordUpdate(userId: string) {
  console.error(JSON.stringify({ event: "registration_password_update_uncertain", correlation_id: randomUUID(), user_id: userId, occurred_at: new Date().toISOString() }));
}