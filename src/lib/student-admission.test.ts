import {describe,it,expect} from "vitest";
import {admissionErrors,type StudentAdmission} from "./student-admission";
const form:StudentAdmission={full_name:"Test Student",email:"qa@example.test",password:"Synthetic!Long2026",phone:"+971 500 000000",admission_on:"2026-10-15",program_id:"66106212-52d7-4c4b-9e62-db3534bfe011",batch_id:"fe5b1e6c-0ade-4fdc-a914-5c8d3fa1e8e3",access_starts_at:"2026-10-15T08:00:00Z",access_expires_at:null,unassigned:false,is_active:true,guardian_name:"",guardian_phone:"",guardian_relationship:"",address:"",internal_notes:""};
describe("student admission validation",()=>{
  it("accepts a complete coded admission and explicit no expiry",()=>expect(admissionErrors(form)).toEqual({}));
  it("requires program and batch together for admission",()=>expect(admissionErrors({...form,program_id:"",batch_id:""})).toMatchObject({program_id:expect.any(String),batch_id:expect.any(String)}));
  it("accepts explicitly unassigned without partial access",()=>expect(admissionErrors({...form,unassigned:true,program_id:"",batch_id:""})).toEqual({}));
  it("rejects inconsistent unassigned access",()=>expect(admissionErrors({...form,unassigned:true}).batch_id).toBeTruthy());
  it.each(["bad", "2026-10-15T07:59:59Z"])("rejects invalid or reversed expiry %s",expiry=>expect(admissionErrors({...form,access_expires_at:expiry}).access_expires_at).toBeTruthy());
  it("rejects invalid passwords and phone fields",()=>expect(admissionErrors({...form,password:"short",phone:"<script>",guardian_phone:"x"})).toMatchObject({password:expect.any(String),phone:expect.any(String),guardian_phone:expect.any(String)}));
  it("bounds contact and internal-note values",()=>expect(admissionErrors({...form,internal_notes:"x".repeat(4001)}).internal_notes).toBeTruthy());
});
