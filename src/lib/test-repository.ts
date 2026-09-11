import { createClient } from "./supabase/client";
import type { CoreData, Question, Test } from "./core-repository";
const check = <T,>(r: {data:T; error:{message:string}|null}):T => {if(r.error)throw new Error(r.error.message);return r.data;};
type Hierarchy = Pick<CoreData,"exams"|"programs"|"subjects"|"chapters"|"topics"|"batches"|"mappings">;
// Only hierarchy is cached, isolated by authenticated user. Roles, tests, and
// active question availability are fetched afresh; RLS still applies to writes.
let hierarchy: {user:string; expires:number; promise:Promise<Hierarchy>} | undefined;
export function clearTestHierarchy() { hierarchy = undefined; }
async function metadata(user:string):Promise<Hierarchy> {
  if(hierarchy?.user===user && hierarchy.expires>Date.now())return hierarchy.promise;
  const db=createClient();
  const promise=Promise.all([
    db.from("entrance_exams").select("id,name"),
    db.from("programs").select("id,name,exam_id"),
    db.from("subjects").select("id,name"),
    db.from("chapters").select("id,name,subject_id,program_id"),
    db.from("topics").select("id,name,subject_id,chapter_id,program_id"),
    db.from("batches").select("id,name,program_id"),
    db.from("program_subjects").select("program_id,subject_id"),
  ]).then(results=>{
    const [exams,programs,subjects,chapters,topics,batches,mappings]=results.map(r=>{if(r.error)throw new Error(r.error.message);return r.data;});
    return {exams,programs,subjects,chapters,topics,batches,mappings} as Hierarchy;
  }).catch(e=>{hierarchy=undefined;throw e;});
  hierarchy={user,expires:Date.now()+60_000,promise};return promise;
}
export async function loadTestWorkspace():Promise<CoreData> {
  const db=createClient();
  const auth=await db.auth.getUser();if(auth.error)throw new Error(auth.error.message);const user=auth.data.user;
  if(!user)throw new Error("Sign in to continue.");
  const [academic,profile,tests,assignments]=await Promise.all([
    metadata(user.id),
    db.from("profiles").select("role,is_active").eq("id",user.id).single(),
    db.from("tests").select("*,test_questions(question_id,display_order),test_batches(batch_id)").order("created_at",{ascending:false}),
    db.from("faculty_assignments").select("*"),
  ]);
  const p=check(profile);if(!p?.is_active)throw new Error("Account is inactive.");
  return {...academic,role:p.role,assignments:check(assignments)||[],questions:[],content:[],
    tests:(check(tests)||[]).map(t=>({...t,question_ids:t.test_questions.sort((a:{display_order:number},b:{display_order:number})=>a.display_order-b.display_order).map((q:{question_id:string})=>q.question_id),batch_ids:t.test_batches.map((b:{batch_id:string})=>b.batch_id)})) as Test[]};
}
export async function loadTestQuestionIndex(role:string):Promise<Question[]> {
  const db=createClient(),rows:Question[]=[];
  if(role==="teacher")return check(await db.rpc("core_test_bank"))||[];
  for(let offset=0;;offset+=1000){
    const page=check(await db.from("questions").select("id,exam_id,program_id,subject_id,chapter_id,topic_id,type,status,difficulty,marks,prompt,source_label,source_reference").order("id").range(offset,offset+999))||[];
    rows.push(...page.map(q=>({...q,negative_marks:0,source_type:"standard",exam_year:"",exam_session:"",options:[],media:[],explanation:"",stem_image_path:"",explanation_image_path:"",source_label:q.source_label||"",source_reference:q.source_reference||""})) as Question[]);
    if(page.length<1000)break;
  }
  return rows;
}
export async function loadQuestionPreview(id:string):Promise<Question> {
  const q=check(await createClient().from("questions").select("*,question_options!question_options_question_id_fkey(id,content,content_rich,display_order),question_answer_keys(option_id),question_media(*)").eq("id",id).single());
  return {...q,media:q.question_media,options:q.question_options.sort((a:{display_order:number},b:{display_order:number})=>a.display_order-b.display_order).map((o:{id:string;content:string})=>({...o,correct:q.question_answer_keys.some((k:{option_id:string})=>k.option_id===o.id)}))} as Question;
}
