import {beforeEach,describe,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({requests:[] as {table:string;select?:string}[],rpc:[] as {name:string;args:unknown}[],role:"admin"}));
vi.mock("./supabase/client",()=>({createClient:()=>({
 auth:{getUser:async()=>({data:{user:{id:"admin-id"}},error:null})},
 rpc:async(name:string,args:unknown)=>{mock.rpc.push({name,args});return {data:{rows:[{id:"q1",prompt:"Q",status:"active",marks:1}],total:1,scope_total:1,by_subject:{subject:1}},error:null};},
 from:(table:string)=>{
  const entry:{table:string;select?:string}={table};mock.requests.push(entry);
  const result=()=>({data:table==="profiles"?{role:mock.role,is_active:true}:[],error:null});
  const chain={select:(columns:string)=>{entry.select=columns;return chain;},eq:()=>chain,order:()=>chain,range:()=>chain,single:()=>Promise.resolve(result()),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};
  return chain;
 }
})}));
import {clearTestHierarchy,loadAcademicMetadata,loadTestWorkspace,loadTestQuestionPage} from "./test-repository";
import {newTest} from "./core-repository";
describe("test workspace fetch boundaries",()=>{
 beforeEach(()=>{mock.requests=[];mock.rpc=[];clearTestHierarchy();});
 it("renders the test list without question, media, option, answer-key, or learning-content queries",async()=>{
  const data=await loadTestWorkspace();
  expect(data.questions).toEqual([]);
  expect(mock.requests.map(r=>r.table)).not.toEqual(expect.arrayContaining(["questions"]));
  expect(mock.requests.some(r=>/questions$|question_media|question_options|question_answer_keys|learning_content/.test(r.table))).toBe(false);
  expect(mock.requests.find(r=>r.table==="subjects")?.select).toBe("id,name");
 });
 it("reuses only hierarchy while refreshing profiles and tests",async()=>{
  await loadTestWorkspace();await loadTestWorkspace();
  expect(mock.requests.filter(r=>r.table==="subjects")).toHaveLength(1);
  expect(mock.requests.filter(r=>r.table==="profiles")).toHaveLength(2);
  expect(mock.requests.filter(r=>r.table==="tests")).toHaveLength(2);
 });
 it("reuses the server-validated Admin identity without another profile request",async()=>{
  await loadTestWorkspace({id:"admin-id",role:"admin"});
  expect(mock.requests.some(r=>r.table==="profiles")).toBe(false);
 });
 it("pages the manual selector through one lightweight server RPC",async()=>{
  const page=await loadTestQuestionPage({...newTest(),exam_id:"exam",program_id:"program",subject_id:"subject"},2,"anaemia");
  expect(page.rows).toHaveLength(1);expect(mock.requests).toHaveLength(0);
  expect(mock.rpc).toEqual([{name:"core_test_question_page",args:expect.objectContaining({page_number:2,page_size:20,search_text:"anaemia"})}]);
 });
 it("isolates cached academic hierarchy by authenticated user",async()=>{
  await loadAcademicMetadata("admin-id");await loadAcademicMetadata("admin-id");
  expect(mock.requests.filter(r=>r.table==="subjects")).toHaveLength(1);
  await loadAcademicMetadata("teacher-id");
  expect(mock.requests.filter(r=>r.table==="subjects")).toHaveLength(2);
 });
});
