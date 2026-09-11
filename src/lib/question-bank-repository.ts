import {createClient} from "./supabase/client";
import type {CoreData,Question} from "./core-repository";
import {loadAcademicMetadata,loadQuestionPreview} from "./test-repository";
import {QUESTION_PAGE_SIZE,questionSearch,type QuestionFilters} from "./question-bank";
export const QUESTION_LIST_COLUMNS="id,prompt,subject_id,chapter_id,status,type,marks,source_label,source_reference,created_at";
export type QuestionRow=Pick<Question,"id"|"prompt"|"subject_id"|"chapter_id"|"status"|"type"|"marks"|"source_label"|"source_reference">;
export type QuestionActor={id:string;role:string};
export async function questionBankIdentity(actor?:QuestionActor):Promise<QuestionActor> {
  if(actor){if(actor.role!=="admin")throw Error("Admin access required.");return actor;}
  const db=createClient();const auth=await db.auth.getUser();if(auth.error||!auth.data.user)throw Error("Sign in required.");
  const {data,error}=await db.from("profiles").select("role,is_active").eq("id",auth.data.user.id).single();
  if(error||!data?.is_active||data.role!=="admin")throw Error("Admin access required.");return {id:auth.data.user.id,role:data.role};
}
// Identity comes from the existing server guard; every query still uses session RLS.
export async function loadQuestionBankMetadata(actor:QuestionActor):Promise<CoreData> {
  await questionBankIdentity(actor);const academic=await loadAcademicMetadata(actor.id);
  return {...academic,role:actor.role,assignments:[],questions:[],tests:[],content:[]};
}
type SearchHierarchy=Pick<CoreData,"subjects"|"chapters">;
function filtered(filters:QuestionFilters,hierarchy:SearchHierarchy,head=false){
  const columns:string=head?"id":QUESTION_LIST_COLUMNS;
  let query=createClient().from("questions").select(columns,head?{head:true,count:"exact"}:{});
  for(const [field,value] of [["subject_id",filters.subject],["chapter_id",filters.section],["status",filters.status],["source_type",filters.source]])if(value)query=query.eq(field,value);
  if(filters.review)query=query.ilike("source_label","%CONTENT REVIEW REQUIRED%");
  const search=questionSearch(filters.search,hierarchy.subjects,hierarchy.chapters);if(search)query=query.or(search);return query;
}
export async function loadQuestionPage(actor:QuestionActor,filters:QuestionFilters,hierarchy:SearchHierarchy,signal?:AbortSignal):Promise<QuestionRow[]> {
  await questionBankIdentity(actor);
  let query=filtered(filters,hierarchy).order("created_at",{ascending:false}).order("id").range(filters.page*QUESTION_PAGE_SIZE,(filters.page+1)*QUESTION_PAGE_SIZE-1);
  if(signal)query=query.abortSignal(signal);const {data,error}=await query.overrideTypes<QuestionRow[],{merge:false}>();if(error)throw Error("Could not load questions. Please retry.");return data||[];
}
export async function countQuestions(actor:QuestionActor,filters:QuestionFilters,hierarchy:SearchHierarchy,signal?:AbortSignal):Promise<number> {
  await questionBankIdentity(actor);let query=filtered(filters,hierarchy,true);if(signal)query=query.abortSignal(signal);
  const {count,error}=await query;if(error||count===null)throw Error("Could not load the result count. Please retry.");return count;
}
export async function loadQuestionDetail(actor:QuestionActor,id:string):Promise<Question> {
  await questionBankIdentity(actor);
  const q=await loadQuestionPreview(id);return {...q,exam_year:q.exam_year?.toString()||""};
}
