import { beforeEach, describe, expect, it, vi } from "vitest";
const mock=vi.hoisted(()=>({batch:vi.fn(),occupied:vi.fn(),createUser:vi.fn(),ready:vi.fn(),enquiry:vi.fn(),profile:vi.fn(),deleteUser:vi.fn()}));
vi.mock("@/lib/admin-session",()=>({adminSession:async()=>({user:{id:"admin"},db:{rpc:mock.ready,from:(table:string)=>{
  const chain={select:()=>chain,eq:()=>chain,maybeSingle:table==="admission_enquiries"?mock.enquiry:mock.batch,single:mock.profile,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(mock.occupied()).then(resolve)};return chain;
}}})}));
vi.mock("@/lib/supabase/admin",()=>({createAuthAdminClient:()=>({auth:{admin:{createUser:mock.createUser,deleteUser:mock.deleteUser}}})}));
import { POST } from "./route";
const program="10000000-0000-4000-8000-000000000001",batch="10000000-0000-4000-8000-000000000002";
const admission={full_name:"Synthetic Student",email:"student@example.test",password:"Strong!Password12",phone:"",admission_on:"2026-10-15",program_id:program,batch_id:batch,access_starts_at:"2026-10-15T00:00:00Z",access_expires_at:null,unassigned:false,is_active:true,guardian_name:"",guardian_phone:"",guardian_relationship:"",address:"",internal_notes:""};
const request=(changes:Record<string,unknown>={})=>new Request("https://als.example/api/admin/students",{method:"POST",headers:{origin:"https://als.example",host:"als.example","Content-Type":"application/json"},body:JSON.stringify({...admission,...changes})});
describe("admission batch preflight",()=>{
  beforeEach(()=>{vi.resetAllMocks();mock.ready.mockResolvedValue({data:true,error:null});mock.batch.mockResolvedValue({data:{id:batch,program_id:program,batch_code:"DHLT26A",status:"active",max_students:3},error:null});mock.occupied.mockReturnValue({count:3,error:null});});
  it("reports a full batch beside its field without creating Auth",async()=>{const r=await POST(request());expect(r.status).toBe(422);expect((await r.json()).errors.batch_id).toContain("full");expect(mock.createUser).not.toHaveBeenCalled();});
  it("rejects an incompatible batch before Auth creation",async()=>{mock.batch.mockResolvedValue({data:{id:batch,program_id:"other",batch_code:"OTHER",status:"active"},error:null});expect((await POST(request())).status).toBe(422);expect(mock.createUser).not.toHaveBeenCalled();});
  it("fails closed when capacity cannot be verified",async()=>{mock.occupied.mockReturnValue({count:null,error:{message:"private diagnostic"}});const r=await POST(request());expect(r.status).toBe(503);expect(JSON.stringify(await r.json())).not.toContain("private diagnostic");expect(mock.createUser).not.toHaveBeenCalled();});
  it.each([null,false])("does not create ordinary admission Auth when readiness returns %j",async data=>{
    mock.ready.mockResolvedValue({data,error:null});
    expect((await POST(request())).status).toBe(503);
    expect(mock.ready).toHaveBeenCalledWith("lms_admission_ready");
    expect(mock.createUser).not.toHaveBeenCalled();
  });
  it("fails closed before ordinary admission when the readiness migration is missing",async()=>{
    mock.ready.mockResolvedValue({data:null,error:{message:"function lms_admission_ready does not exist"}});
    const response=await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("No account was created");
    expect(mock.createUser).not.toHaveBeenCalled();
  });
  it("fails closed before ordinary admission on a readiness transport failure",async()=>{
    mock.ready.mockRejectedValue(Error("private transport credential"));
    const response=await POST(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private transport credential");
    expect(mock.createUser).not.toHaveBeenCalled();
  });
});

describe("enquiry admission conversion",()=>{
  const enquiryId="10000000-0000-4000-8000-000000000003";
  beforeEach(()=>{
    vi.resetAllMocks();
    mock.ready.mockResolvedValue({data:true,error:null});
    mock.enquiry.mockResolvedValue({data:{id:enquiryId,status:"interested",student_id:null},error:null});
    mock.batch.mockResolvedValue({data:{id:batch,program_id:program,batch_code:"DHLT26A",status:"active",max_students:3},error:null});
    mock.occupied.mockReturnValue({count:0,error:null});
    mock.createUser.mockResolvedValue({data:{user:{id:"student-id"}},error:null});
    mock.profile.mockResolvedValue({data:{id:"student-id",student_code:"ALS-DHLT26A-001",admission_on:"2026-10-15"},error:null});
  });
  it("requires a valid enquiry id before touching Auth",async()=>{
    expect((await POST(request({enquiry_id:"invalid"}))).status).toBe(400);
    expect(mock.createUser).not.toHaveBeenCalled();
  });
  it("requires an actual Program and Batch for conversion",async()=>{
    expect((await POST(request({enquiry_id:enquiryId,unassigned:true,program_id:"",batch_id:""}))).status).toBe(400);
    expect(mock.createUser).not.toHaveBeenCalled();
  });
  it("blocks conversion before Auth creation when the atomic migration is absent",async()=>{
    mock.ready.mockResolvedValue({data:null,error:{message:"function absent"}});
    expect((await POST(request({enquiry_id:enquiryId}))).status).toBe(503);
    expect(mock.createUser).not.toHaveBeenCalled();
  });
  it("does not create another student for a converted enquiry",async()=>{
    mock.enquiry.mockResolvedValue({data:{id:enquiryId,status:"converted",student_id:"existing"},error:null});
    expect((await POST(request({enquiry_id:enquiryId}))).status).toBe(409);
    expect(mock.createUser).not.toHaveBeenCalled();
  });
  it("passes the enquiry to the existing atomic admission trigger",async()=>{
    const response=await POST(request({enquiry_id:enquiryId}));
    expect(response.status).toBe(201);
    expect(mock.createUser).toHaveBeenCalledWith(expect.objectContaining({app_metadata:expect.objectContaining({role:"student",lms_admission:expect.objectContaining({enquiry_id:enquiryId,batch_id:batch,actor_id:"admin"})})}));
    expect(mock.deleteUser).not.toHaveBeenCalled();
  });
  it("reports failed transactional admission without a converted success response",async()=>{
    mock.createUser.mockResolvedValue({data:{user:null},error:{message:"trigger conflict"}});
    const response=await POST(request({enquiry_id:enquiryId}));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("no partial admission");
  });
  it.each(["role","actor_id","app_metadata","user_metadata"])("rejects arbitrary %s metadata before Auth creation",async key=>{
    expect((await POST(request({enquiry_id:enquiryId,[key]:key==="role"?"admin":{role:"admin"}}))).status).toBe(400);
    expect(mock.createUser).not.toHaveBeenCalled();
  });
  it("never deletes a committed identity when the verification read fails",async()=>{
    mock.profile.mockResolvedValue({data:null,error:{message:"temporary database timeout"}});
    const response=await POST(request({enquiry_id:enquiryId}));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expect.objectContaining({recovery_id:"student-id",error:expect.stringContaining("No records were removed")}));
    expect(mock.deleteUser).not.toHaveBeenCalled();
  });
  it("provides safe recovery after a verification transport exception",async()=>{
    mock.profile.mockRejectedValue(Error("private transport error"));
    const response=await POST(request({enquiry_id:enquiryId}));
    const value=await response.json();
    expect(value.recovery_id).toBe("student-id");
    expect(JSON.stringify(value)).not.toContain("private transport error");
    expect(mock.deleteUser).not.toHaveBeenCalled();
  });
  it("preserves the identity for administrator review if admission fields are missing",async()=>{
    mock.profile.mockResolvedValue({data:{id:"student-id",student_code:null,admission_on:null},error:null});
    expect((await POST(request({enquiry_id:enquiryId}))).status).toBe(503);
    expect(mock.deleteUser).not.toHaveBeenCalled();
  });
});
