import { validAccountId } from "./account-validation";
export function validateEnquiry(body: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const text = (key: string) => typeof body[key] === "string" ? body[key].trim() : "";
  const fullName = text("fullName"), phone = text("phone").replace(/[\s().-]/g, ""), email = text("email").toLowerCase();
  const programId = text("programId"), message = text("message"), idempotencyKey = text("idempotencyKey");
  if (fullName.length < 2 || fullName.length > 120) errors.fullName = "Enter your full name (2–120 characters).";
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) errors.phone = "Include your country code, for example +91 98765 43210.";
  if ((body.email !== undefined && body.email !== null && typeof body.email !== "string") || (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) errors.email = "Enter a valid email address.";
  if (!validAccountId(programId)) errors.programId = "Choose an available course.";
  if ((body.message !== undefined && body.message !== null && typeof body.message !== "string") || message.length > 2000) errors.message = "Use up to 2,000 characters.";
  if (body.consent !== true) errors.consent = "Please consent to ALS contacting you about your enquiry.";
  if (!validAccountId(idempotencyKey)) errors.idempotencyKey = "Refresh this page and try again.";
  return { errors, value: { fullName, phone, email: email || null, programId, message: message || null, idempotencyKey } };
}
