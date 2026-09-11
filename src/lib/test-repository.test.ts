import {beforeEach,describe,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({requests:[] as {table:string;select?:string}[],role:"admin"}));
vi.mock("./supabase/client",()=>({createClient:()=>({
 auth:{getUser:async()=>({data:{user:{id:"admin-id"}},error:null})},
 from:(table:string)=>{
  const entry:{table:string;select?:string}={table};mock.requests.push(entry);
  const result=()=>({data:table==="profiles"?{role:mock.role,is_active:true}:[],error:null});
  const chain={select:(columns:string)=>{entry.select=columns;return chain;},eq:()=>chain,order:()=>chain,range:()=>chain,single:()=>Promise.resolve(result()),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};
  return chain;
 }
})}));
import {clearTestHierarchy,loadTestWorkspace,loadTestQuestionIndex} from "./test-repository";
describe("test workspace fetch boundaries",()=>{
 beforeEach(()=>{mock.requests=[];clearTestHierarchy();});
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
 it("loads only the question index for editor availability",async()=>{
  await loadTestQuestionIndex("admin");
  expect(mock.requests).toHaveLength(1);
  expect(mock.requests[0].table).toBe("questions");
  expect(mock.requests[0].select).not.toMatch(/rich|media|explanation|options|answer_keys/);
 });
});
