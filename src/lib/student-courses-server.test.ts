import { beforeEach, describe, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({calls:[] as {table:string;columns:string;filters:Record<string,unknown>;head:boolean}[],expired:false,fail:false}));
vi.mock("server-only",()=>({}));
vi.mock("react",()=>({cache:(fn:unknown)=>fn}));
vi.mock("@/lib/auth",()=>({requireRole:vi.fn(async()=>({id:"student",role:"student"}))}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({from:(table:string)=>{
  const call={table,columns:"",filters:{} as Record<string,unknown>,head:false};state.calls.push(call);
  const q={select:(columns:string,options?:{head?:boolean})=>{call.columns=columns;call.head=!!options?.head;return q;},eq:(key:string,value:unknown)=>{call.filters[key]=value;return q;},order:()=>q,
    then:(resolve:(value:unknown)=>unknown)=>{
      let data:unknown[]=[];
      if(table==="enrollments")data=[{id:"e",status:"active",batch_id:null,batches:null,access_starts_at:null,access_expires_at:state.expired?"2020-01-01":null,programs:{id:"p",slug:"program",name:"Program"}}];
      if(table==="program_subjects")data=[{subjects:{id:"s",name:"Subject"}},{subjects:{id:"t",name:"Other"}}];
      if(table==="recorded_classes")data=[{id:"r",subject_id:"s",status:"published"},{id:"draft",subject_id:"s",status:"draft"},{id:"other",subject_id:"t",status:"published"}].filter(r=>Object.entries(call.filters).every(([k,v])=>r[k as keyof typeof r]===v));
      return Promise.resolve(resolve({data:call.head?null:data,count:call.head?data.length:null,error:state.fail&&table==="recorded_classes"?{message:"internal"}:null}));
    }};return q;
  }})}));
import { getStudentCourse } from "./student-courses-server";
beforeEach(()=>{state.calls=[];state.expired=false;state.fail=false;});
describe("course data requests",()=>{
  it("loads only Published selected-subject recordings and counts, without question/test/dashboard queries",async()=>{
    const data=await getStudentCourse("program","s");expect(data?.recordings.map(r=>r.id)).toEqual(["r"]);expect(data?.counts).toEqual([{subjectId:"t",count:1},{subjectId:"s",count:1}]);
    expect(new Set(state.calls.map(c=>c.table))).toEqual(new Set(["enrollments","program_subjects","recorded_classes","learning_content"]));
    expect(state.calls.filter(c=>c.table==="recorded_classes"&&c.head)).toHaveLength(2);
  });
  it("switches the metadata query to the selected subject",async()=>{const data=await getStudentCourse("program","t");expect(data?.recordings.map(r=>r.id)).toEqual(["other"]);expect(state.calls.find(c=>c.table==="learning_content")?.filters.subject_id).toBe("t");});
  it("refuses expired enrollment before fetching subject content",async()=>{state.expired=true;expect(await getStudentCourse("program","s")).toBeNull();expect(state.calls.map(c=>c.table)).toEqual(["enrollments"]);});
  it("does not mask query failure as zero content",async()=>{state.fail=true;await expect(getStudentCourse("program","s")).rejects.toThrow(/could not be loaded/);});
});
