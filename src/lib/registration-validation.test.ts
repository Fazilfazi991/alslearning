import { describe, expect, it } from "vitest";
import { validateRegistration } from "./registration-validation";

const valid = { fullName: " Student Name ", email: "STUDENT@example.com", phone: "+91 98765-43210", qualification: "BSc MLT", institution: "Example College", programId: "b3548351-7268-4d05-87f8-f5804d333b5d", preferredBatchId: "", notes: "", consent: true, requestId: "30435434-6d02-43bc-a93e-4c1b638af675" };
describe("registration application validation", () => {
  it("normalizes contact details and accepts optional fields", () => { const r = validateRegistration(valid); expect(r.errors).toEqual({}); expect(r.value).toMatchObject({ fullName: "Student Name", email: "student@example.com", phone: "+919876543210", preferredBatchId: null, notes: null }); });
  it("rejects missing required fields and consent", () => { const r = validateRegistration({ ...valid, fullName: "", email: "wrong", phone: "123", qualification: "", institution: "", programId: "bad", consent: false }); expect(Object.keys(r.errors)).toEqual(["fullName", "email", "phone", "qualification", "institution", "programId", "consent"]); expect(r.value).toBeNull(); });
  it("rejects forged or malformed optional inputs and unsupported fields", () => { const r = validateRegistration({ ...valid, preferredBatchId: {}, notes: [], role: "admin" }); expect(r.errors).toMatchObject({ form: expect.any(String), preferredBatchId: expect.any(String), notes: expect.any(String) }); });
  it("rejects oversized details and invalid request keys", () => { const r = validateRegistration({ ...valid, fullName: "x".repeat(121), qualification: "x".repeat(161), institution: "x".repeat(201), notes: "x".repeat(2001), requestId: "bad" }); expect(Object.keys(r.errors)).toEqual(["fullName", "qualification", "institution", "notes", "requestId"]); });
});
