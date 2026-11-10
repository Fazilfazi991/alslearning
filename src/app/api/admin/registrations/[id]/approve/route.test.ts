import { beforeEach, describe, expect, it, vi } from "vitest";
const mock=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),create:vi.fn(),invite:vi.fn(),sameOrigin:vi.fn(),admin:vi.fn()}));
vi.mock("@/lib/admin-session",()=>({adminSession:mock.admin}));
vi.mock("@/lib/supabase/admin",()=>({createAuthAdminClient:()=>({auth:{admin:{createUser:mock.create}}})}));
vi.mock("@/lib/request-origin",()=>({isSameOriginRequest:mock.sameOrigin}));
vi.mock("@/lib/registration-invitation",()=>({sendRegistrationInvitation:mock.invite}));
import { POST } from "./route";
const registration="d28bfc7d-2bbf-4a13-a4ea-d95a1eac1b56", batch="7843fdc1-95d1-4aa6-a820-2c218f58474b", program="5419a4c7-730b-438b-801a-c3d9ffcb3c98", student="8519af58-9be7-4608-aaef-a6c1f467a087";
const application={id:registration,full_name:"Student Name",email:"student@example.test",phone:"+919876543210",qualification:"Degree",institution:"School",program_id:program,consent_at:"2026-01-01",enquiry_id:null,status:"pending",student_id:null};
function request(){return new Request("https://example.test/api/admin/registrations/"+registration+"/approve",{method:"POST",body:JSON.stringify({batch_id:batch})});}
function query(data:unknown){return {select:()=>({eq:()=>({maybeSingle:async()=>({data,error:null})})})};}
beforeEach(()=>{vi.resetAllMocks();mock.sameOrigin.mockReturnValue(true);mock.rpc.mockResolvedValue({data:true,error:null});mock.admin.mockResolvedValue({db:{rpc:mock.rpc,from:mock.from},user:{id:"admin"}});mock.create.mockResolvedValue({data:{user:{id:student}},error:null});mock.invite.mockResolvedValue("sent");mock.from.mockImplementationOnce(()=>query(application)).mockImplementationOnce(()=>query({id:batch,program_id:program,batch_code:"ALS",status:"active"})).mockImplementationOnce(()=>query({status:"approved",student_id:student,email:application.email}));});
describe("registration approval",()=>{
  it("fails closed when the admission migration is unavailable",async()=>{mock.rpc.mockResolvedValueOnce({data:false,error:null});const result=await POST(request(),{params:Promise.resolve({id:registration})});expect(result.status).toBe(503);expect(mock.create).not.toHaveBeenCalled();});
  it("creates an unconfirmed account only after checks and sends after verified approval",async()=>{const result=await POST(request(),{params:Promise.resolve({id:registration})});expect(result.status).toBe(200);expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({email_confirm:false,app_metadata:expect.objectContaining({lms_admission:expect.objectContaining({registration_id:registration,batch_id:batch})})}));expect(mock.create.mock.calls[0][0]).not.toHaveProperty("password");expect(mock.invite).toHaveBeenCalledWith(registration,student,application.email);});
  it("does not invite if the committed admission cannot be verified",async()=>{mock.from.mockReset().mockImplementationOnce(()=>query(application)).mockImplementationOnce(()=>query({id:batch,program_id:program,batch_code:"ALS",status:"active"})).mockImplementationOnce(()=>query(null));const result=await POST(request(),{params:Promise.resolve({id:registration})});expect(result.status).toBe(503);expect(mock.invite).not.toHaveBeenCalled();});
  it("rejects cross-origin requests before looking up an administrator",async()=>{mock.sameOrigin.mockReturnValue(false);const result=await POST(request(),{params:Promise.resolve({id:registration})});expect(result.status).toBe(403);expect(mock.admin).not.toHaveBeenCalled();});
});
