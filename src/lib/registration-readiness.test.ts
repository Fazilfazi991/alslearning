import { describe, expect, it } from "vitest";
import { registrationReadiness, type RegistrationBatch } from "./registration-readiness";
const batch: RegistrationBatch = { id:"batch-a", programId:"program-a", status:"active", batchCode:"A", maxStudents:3, reservedSeats:2, approvedDefault:true };
const base = { status:"pending" as const, programId:"program-a", programActive:true, selectedBatchId:"batch-a", batches:[batch], missingFields:[], identityConflict:false };
describe("registration approval preflight", () => {
  it("offers the one eligible explicitly approved default", () => { expect(registrationReadiness(base)).toEqual({ proposedBatchId:"batch-a", ready:true, reasons:[] }); });
  it("never invents a default or chooses between multiple defaults", () => { expect(registrationReadiness({...base,batches:[{...batch,approvedDefault:false}]}).proposedBatchId).toBeNull(); expect(registrationReadiness({...base,batches:[batch,{...batch,id:"batch-b"}]}).proposedBatchId).toBeNull(); });
  it("rejects full, uncoded, inactive and incompatible batches", () => { for(const b of [{...batch,reservedSeats:3},{...batch,batchCode:null},{...batch,status:"closed"},{...batch,programId:"other"}]) { const r=registrationReadiness({...base,batches:[b]}); expect(r.ready).toBe(false); expect(r.proposedBatchId).toBeNull(); } });
  it("allows unlimited capacity with a valid reservation count", () => { const b={...batch,maxStudents:null,reservedSeats:100}; expect(registrationReadiness({...base,batches:[b]}).ready).toBe(true); });
  it("requires explicit selection and flags missing information and identity conflicts", () => { const r=registrationReadiness({...base,selectedBatchId:null,missingFields:["qualification"],identityConflict:true}); expect(r.ready).toBe(false); expect(r.reasons).toEqual(["Missing qualification.","An existing identity needs review before approval.","Choose a compatible batch."]); });
  it("keeps information requests blocked until they are resolved", () => { expect(registrationReadiness({...base,status:"needs_information"}).ready).toBe(false); });
  it("rejects a decided application even when the batch is available", () => { expect(registrationReadiness({...base,status:"approved"}).ready).toBe(false); expect(registrationReadiness({...base,status:"rejected"}).ready).toBe(false); });
});
