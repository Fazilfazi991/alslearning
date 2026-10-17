import { beforeEach, describe, expect, it, vi } from "vitest";
const mock=vi.hoisted(()=>({batch:vi.fn(),occupied:vi.fn(),createUser:vi.fn()}));
vi.mock("@/lib/admin-session",()=>({adminSession:async()=>({user:{id:"admin"},db:{from:()=>{
  const chain={select:()=>chain,eq:()=>chain,maybeSingle:mock.batch,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(mock.occupied()).then(resolve)};return chain;
},rpc:mock.occupied}})}));
vi.mock("@/lib/supabase/admin",()=>({createAuthAdminClient:()=>({auth:{admin:{createUser:mock.createUser},rpc:mock.occupied}})}));
import { POST } from "./route";
const program="10000000-0000-4000-8000-000000000001",batch="10000000-0000-4000-8000-000000000002";
const admission={full_name:"Synthetic Student",email:"student@example.test",password:"Strong!Password12",phone:"",admission_on:"2026-10-15",program_id:program,batch_id:batch,access_starts_at:"2026-10-15T00:00:00Z",access_expires_at:null,unassigned:false,is_active:true,guardian_name:"",guardian_phone:"",guardian_relationship:"",address:"",internal_notes:""};
const request=()=>new Request("https://als.example/api/admin/students",{method:"POST",headers:{origin:"https://als.example",host:"als.example","Content-Type":"application/json"},body:JSON.stringify(admission)});
describe("admission batch preflight",()=>{
  beforeEach(()=>{vi.resetAllMocks();mock.batch.mockResolvedValue({data:{id:batch,program_id:program,batch_code:"DHLT26A",status:"active",max_students:3},error:null});mock.occupied.mockResolvedValue({data:[{batch_id:batch,occupied:3}],error:null});});
  it("reports a full batch beside its field without creating Auth",async()=>{const r=await POST(request());expect(r.status).toBe(422);expect((await r.json()).errors.batch_id).toContain("full");expect(mock.createUser).not.toHaveBeenCalled();});
  it("rejects an incompatible batch before Auth creation",async()=>{mock.batch.mockResolvedValue({data:{id:batch,program_id:"other",batch_code:"OTHER",status:"active"},error:null});expect((await POST(request())).status).toBe(422);expect(mock.createUser).not.toHaveBeenCalled();});
  it("fails closed when capacity cannot be verified",async()=>{mock.occupied.mockResolvedValue({data:null,error:{message:"private diagnostic"}});const r=await POST(request());expect(r.status).toBe(503);expect(JSON.stringify(await r.json())).not.toContain("private diagnostic");expect(mock.createUser).not.toHaveBeenCalled();});
});
