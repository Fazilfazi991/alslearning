import {beforeEach,describe,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({requests:[] as {table:string;calls:[string,...unknown[]][]}[],error:null as null|{message:string},count:2472,role:"admin",active:true,rows:[{id:"q",prompt:"Stem"}],assignments:[{subject_id:"assigned",program_id:null,can_manage_questions:true}],detail:vi.fn(),metadata:vi.fn()}));
vi.mock("./test-repository",()=>({loadQuestionPreview:mock.detail,loadAcademicMetadata:mock.metadata}));
vi.mock("./supabase/client",()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:{id:"admin"}},error:null})},from:(table:string)=>{
 const r={table,calls:[] as [string,...unknown[]][]};mock.requests.push(r);
 const result=()=>({data:table==="profiles"?{role:mock.role,is_active:mock.active}:table==="faculty_assignments"?mock.assignments:mock.rows,error:mock.error,count:mock.count});
 const chain:Record<string,unknown>={then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};
 for(const name of ["select","eq","ilike","or","order","range","abortSignal","single","overrideTypes"])chain[name]=(...args:unknown[])=>{r.calls.push([name,...args]);return chain;};return chain;
}})}));
import {loadQuestionPage,countQuestions,loadQuestionDetail,questionBankIdentity,loadQuestionBankMetadata,QUESTION_LIST_COLUMNS} from "./question-bank-repository";
import {emptyQuestionFilters} from "./question-bank";
const actor={id:"admin",role:"admin"},hierarchy={subjects:[],chapters:[]};
describe("bounded authenticated question-bank queries",()=>{
 beforeEach(()=>{mock.requests=[];mock.error=null;mock.count=2472;mock.role="admin";mock.active=true;mock.detail.mockReset();mock.metadata.mockReset();});
 it.each([0,1,399])("fetches exactly one bounded page %i without any full-bank loop",async(page)=>{await loadQuestionPage(actor,{...emptyQuestionFilters,page},hierarchy);expect(mock.requests).toHaveLength(1);expect(mock.requests[0].calls).toContainEqual(["range",page*25,page*25+24]);expect(mock.requests[0].calls).toContainEqual(["select",QUESTION_LIST_COLUMNS,{}]);expect(QUESTION_LIST_COLUMNS).not.toMatch(/\*|rich|options|answer|explanation|media/);expect(mock.detail).not.toHaveBeenCalled();});
 it("counts with HEAD and returns exact count without downloading rows",async()=>{expect(await countQuestions(actor,emptyQuestionFilters,hierarchy)).toBe(2472);expect(mock.requests[0].calls).toContainEqual(["select","id",{head:true,count:"exact"}]);expect(mock.requests[0].calls.some(c=>c[0]==="range")).toBe(false);});
 it("applies identical subject,section,Draft,source,review and search to list and count",async()=>{const f={...emptyQuestionFilters,subject:"s",section:"c",status:"draft",source:"standard",review:true,search:"DNA"};await loadQuestionPage(actor,f,hierarchy);await countQuestions(actor,f,hierarchy);const filters=(i:number)=>mock.requests[i].calls.filter(c=>["eq","ilike","or"].includes(c[0]));expect(filters(0)).toEqual(filters(1));expect(filters(0)).toContainEqual(["eq","status","draft"]);expect(filters(0)).toContainEqual(["eq","subject_id","s"]);expect(filters(0)).toContainEqual(["eq","chapter_id","c"]);});
 it("honors cancellation and stable two-column ordering",async()=>{const signal=new AbortController().signal;await loadQuestionPage(actor,emptyQuestionFilters,hierarchy,signal);expect(mock.requests[0].calls).toContainEqual(["abortSignal",signal]);expect(mock.requests[0].calls).toContainEqual(["order","created_at",{ascending:false}]);expect(mock.requests[0].calls).toContainEqual(["order","id"]);});
 it("does not report failed query as empty or zero",async()=>{mock.error={message:"private database internals"};await expect(loadQuestionPage(actor,emptyQuestionFilters,hierarchy)).rejects.toThrow("Could not load questions");await expect(countQuestions(actor,emptyQuestionFilters,hierarchy)).rejects.toThrow("Could not load the result count");});
 it("loads full canonical detail only on request",async()=>{const q={id:"q",prompt:"",prompt_rich:{blocks:[]},explanation_rich:{blocks:[]},media:[{id:"emf",source:{original:{sha256:"source"}}}],options:[{content:"A",correct:true}],exam_year:2025};mock.detail.mockResolvedValue(q);const result=await loadQuestionDetail(actor,"q");expect(mock.detail).toHaveBeenCalledWith("q");expect(result).toEqual({...q,exam_year:"2025"});});
 it.each(["student",""])("rejects %s before querying the author list",async(role)=>{await expect(loadQuestionPage({...actor,role},emptyQuestionFilters,hierarchy)).rejects.toThrow("Author access");expect(mock.requests).toHaveLength(0);});
 it("permits Teacher through the same bounded, session-RLS list",async()=>{const teacher={id:"teacher",role:"teacher"};await loadQuestionPage(teacher,{...emptyQuestionFilters,page:399},hierarchy);expect(mock.requests).toHaveLength(1);expect(mock.requests[0].calls).toContainEqual(["range",9975,9999]);expect(mock.requests[0].calls).toContainEqual(["select",QUESTION_LIST_COLUMNS,{}]);});
 it("rejects an inactive canonical profile",async()=>{mock.active=false;await expect(questionBankIdentity()).rejects.toThrow("Author access");});
 it("reuses the server identity without duplicate auth/profile queries",async()=>{await questionBankIdentity(actor);expect(mock.requests).toHaveLength(0);});
 it("loads academic metadata without tests, content or question queries",async()=>{mock.metadata.mockResolvedValue(hierarchy);const data=await loadQuestionBankMetadata(actor);expect(mock.metadata).toHaveBeenCalledWith("admin");expect(mock.requests).toHaveLength(0);expect(data.questions).toEqual([]);});
 it("limits Teacher filters to assigned subjects and matching sections",async()=>{
  mock.metadata.mockResolvedValue({exams:[],programs:[],batches:[],subjects:[{id:"assigned",name:"Assigned"},{id:"other",name:"Other"}],chapters:[{id:"a",subject_id:"assigned"},{id:"o",subject_id:"other"}],topics:[{id:"at",subject_id:"assigned"},{id:"ot",subject_id:"other"}],mappings:[]});
  const data=await loadQuestionBankMetadata({id:"teacher",role:"teacher"});
  expect(data.subjects.map(row=>row.id)).toEqual(["assigned"]);expect(data.chapters.map(row=>row.id)).toEqual(["a"]);expect(data.topics.map(row=>row.id)).toEqual(["at"]);
  expect(data.assignments).toEqual(mock.assignments);
  expect(mock.requests[0].calls).toContainEqual(["select","exam_id,program_id,subject_id,can_manage_content,can_manage_questions,can_manage_tests"]);
  expect(mock.requests.map(request=>request.table)).toEqual(["faculty_assignments"]);expect(mock.requests[0].calls).toContainEqual(["eq","faculty_id","teacher"]);
 });
});
