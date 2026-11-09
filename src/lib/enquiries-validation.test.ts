import { describe, expect, it } from "vitest";
import { validateEnquiry } from "./enquiries-validation";
const valid = { fullName: " Student Name ", phone: "+91 98765-43210", email: "STUDENT@example.com", programId: "b3548351-7268-4d05-87f8-f5804d333b5d", message: "Please call", consent: true, idempotencyKey: "30435434-6d02-43bc-a93e-4c1b638af675" };
describe("public enquiry validation", () => {
  it("normalizes international phone, email and names", () => {
    const result = validateEnquiry(valid); expect(result.errors).toEqual({}); expect(result.value.phone).toBe("+919876543210"); expect(result.value.email).toBe("student@example.com"); expect(result.value.fullName).toBe("Student Name");
  });
  it("permits optional contact email and message", () => { const result = validateEnquiry({ ...valid, email: "", message: "" }); expect(result.errors).toEqual({}); expect(result.value.email).toBeNull(); });
  it("rejects local numbers, missing consent and malformed references", () => { const result = validateEnquiry({ ...valid, phone: "9876543210", consent: "true", programId: "x", idempotencyKey: "bad" }); expect(Object.keys(result.errors)).toEqual(["phone", "programId", "consent", "idempotencyKey"]); });
  it("bounds every user supplied text field", () => { const result = validateEnquiry({ ...valid, fullName: "x".repeat(121), email: "x".repeat(255), message: "x".repeat(2001) }); expect(Object.keys(result.errors)).toEqual(["fullName", "email", "message"]); });
  it("does not coerce malicious JSON objects or arrays into strings", () => { const result = validateEnquiry({ ...valid, fullName: {}, phone: [], email: {} }); expect(result.errors.fullName).toBeDefined(); expect(result.errors.phone).toBeDefined(); });
});
