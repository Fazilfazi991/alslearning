import { createClient } from "@/lib/supabase/client";
import type { AcademicEntity, AcademicQuestion, AcademicWorkspace, QuestionSource, QuestionType, RecordStatus } from "@/types/academic";

type Row=Record<string,unknown>;
const tableByKind={exam:"entrance_exams",program:"programs",subject:"subjects",chapter:"chapters",topic:"topics",batch:"batches",video:"learning_content",material:"learning_content"} as const;
function tableFor(kind:AcademicEntity["kind"]){if(!(kind in tableByKind))throw new Error(`Unsupported academic entity: ${kind}`);return tableByKind[kind as keyof typeof tableByKind]}
const dbStatus=(s:RecordStatus)=>s.toLowerCase();
const uiStatus=(s:unknown):RecordStatus=>s==="active"?"Active":s==="archived"?"Archived":"Draft";
const questionTypeToDb:Record<QuestionType,string>={"Single-answer MCQ":"single_mcq","Multiple-answer MCQ":"multiple_mcq","True / False":"true_false","Image-based MCQ":"image_mcq","Case-based":"case_based","Match-the-following":"match_following"};
const questionTypeFromDb=Object.fromEntries(Object.entries(questionTypeToDb).map(([a,b])=>[b,a])) as Record<string,QuestionType>;
const sourceToDb:Record<QuestionSource,string>={Standard:"standard","Previous exam":"previous_exam",Recalled:"recalled"};
const sourceFromDb=Object.fromEntries(Object.entries(sourceToDb).map(([a,b])=>[b,a])) as Record<string,QuestionSource>;

function entity(row:Row,kind:AcademicEntity["kind"],parentId?:string):AcademicEntity{return{id:String(row.id),kind,name:String(row.name??row.title),slug:String(row.slug),parentId,status:uiStatus(row.status),order:Number(row.display_order||0),description:row.description?String(row.description):undefined}}
function assert(error:{message:string}|null){if(error)throw new Error(error.message)}

export async function loadAcademicWorkspace():Promise<AcademicWorkspace>{
  const db=createClient();
  const [exams,programs,subjects,chapters,topics,batches,content,questions]=await Promise.all([
    db.from("entrance_exams").select("*").order("display_order"),db.from("programs").select("*").order("display_order"),
    db.from("subjects").select("*").order("display_order"),db.from("chapters").select("*").order("display_order"),
    db.from("topics").select("*").order("display_order"),db.from("batches").select("*").order("created_at"),
    db.from("learning_content").select("*").in("kind",["video","pdf","note","document","image","external_link"]).order("display_order"),
    db.from("questions").select("*,question_options(*)").order("created_at",{ascending:false}).limit(100),
  ]);[exams,programs,subjects,chapters,topics,batches,content,questions].forEach(x=>assert(x.error));
  const entities:AcademicEntity[]=[
    ...(exams.data||[]).map(x=>entity(x,"exam")),...(programs.data||[]).map(x=>entity(x,"program",x.exam_id||undefined)),
    ...(subjects.data||[]).map(x=>entity(x,"subject")),...(chapters.data||[]).map(x=>entity(x,"chapter",x.program_id||x.subject_id)),
    ...(topics.data||[]).map(x=>entity(x,"topic",x.chapter_id||x.subject_id)),...(batches.data||[]).map(x=>entity({...x,display_order:0},"batch",x.program_id)),
    ...(content.data||[]).map(x=>entity(x,x.kind==="video"?"video":"material",x.topic_id||x.chapter_id||x.subject_id||x.program_id)),
  ];
  const byId=new Map(entities.map(x=>[x.id,x]));
  const mappedQuestions:AcademicQuestion[]=(questions.data||[]).map(q=>{const options=(q.question_options||[]).sort((a:Row,b:Row)=>Number(a.display_order)-Number(b.display_order));return{id:q.id,question:q.prompt,type:questionTypeFromDb[q.type]||"Single-answer MCQ",exam:byId.get(q.exam_id)?.name||"",program:byId.get(q.program_id)?.name,subject:byId.get(q.subject_id)?.name||"",chapter:byId.get(q.chapter_id)?.name,topic:byId.get(q.topic_id)?.name,options:options.map((o:Row)=>String(o.content)),correctAnswers:options.filter((o:Row)=>o.is_correct).map((o:Row)=>String(o.content)),explanation:q.explanation||"",difficulty:q.difficulty==="easy"?"Easy":q.difficulty==="hard"?"Hard":"Medium",marks:Number(q.marks),negativeMarks:Number(q.negative_marks),sourceType:sourceFromDb[q.source_type]||"Standard",sourceReference:q.source_reference||undefined,examYear:q.exam_year||undefined,status:uiStatus(q.status)}});
  return{entities,questions:mappedQuestions};
}

export async function saveAcademicEntity(item:AcademicEntity,all:AcademicEntity[]){
  const db=createClient(),parent=all.find(x=>x.id===item.parentId);let payload:Row={id:item.id,slug:item.slug,name:item.name,description:item.description||null,status:dbStatus(item.status),display_order:item.order};
  if(item.kind==="program")payload.exam_id=parent?.kind==="exam"?parent.id:null;
  if(item.kind==="chapter"){if(parent?.kind!=="subject")throw new Error("A chapter must belong to a subject.");payload.subject_id=parent.id;payload.program_id=null}
  if(item.kind==="topic"){const subjectId=parent?.kind==="subject"?parent.id:parent?.kind==="chapter"?all.find(x=>x.id===parent.parentId&&x.kind==="subject")?.id:undefined;if(!subjectId)throw new Error("A topic must belong to a subject or a chapter with a subject.");payload.subject_id=subjectId;payload.chapter_id=parent?.kind==="chapter"?parent.id:null;payload.program_id=null}
  if(item.kind==="batch"){payload={id:item.id,slug:item.slug,name:item.name,program_id:item.parentId,status:item.status==="Archived"?"archived":item.status==="Active"?"active":"upcoming"}}
  if(item.kind==="video"||item.kind==="material"){payload={id:item.id,slug:item.slug,title:item.name,description:item.description||null,kind:item.kind==="video"?"video":"note",status:dbStatus(item.status),display_order:item.order,external_url:"about:blank",program_id:parent?.kind==="program"?parent.id:null,subject_id:parent?.kind==="subject"?parent.id:null,chapter_id:parent?.kind==="chapter"?parent.id:null,topic_id:parent?.kind==="topic"?parent.id:null}}
  const{error}=await db.from(tableFor(item.kind)).upsert(payload);assert(error);
}
export async function archiveAcademicEntity(item:AcademicEntity){const{error}=await createClient().from(tableFor(item.kind)).update({status:item.status==="Archived"?"active":"archived"}).eq("id",item.id);assert(error)}
export async function deleteAcademicEntity(item:AcademicEntity){const{error}=await createClient().from(tableFor(item.kind)).delete().eq("id",item.id);assert(error)}
export async function persistEntityOrder(items:AcademicEntity[]){await Promise.all(items.filter(x=>x.kind!=="batch").map(item=>createClient().from(tableFor(item.kind)).update({display_order:item.order}).eq("id",item.id).then(({error})=>assert(error))))}

export async function saveQuestion(q:AcademicQuestion,entities:AcademicEntity[]){const db=createClient(),find=(kind:AcademicEntity["kind"],name?:string)=>entities.find(x=>x.kind===kind&&x.name===name)?.id;const{error}=await db.from("questions").upsert({id:q.id,prompt:q.question,type:questionTypeToDb[q.type],exam_id:find("exam",q.exam),program_id:find("program",q.program),subject_id:find("subject",q.subject),chapter_id:find("chapter",q.chapter),topic_id:find("topic",q.topic),explanation:q.explanation,difficulty:q.difficulty.toLowerCase(),marks:q.marks,negative_marks:q.negativeMarks,source_type:sourceToDb[q.sourceType],source_reference:q.sourceReference||null,exam_year:q.examYear||null,status:dbStatus(q.status)});assert(error);const removed=await db.from("question_options").delete().eq("question_id",q.id);assert(removed.error);const options=q.options.map((content,index)=>({question_id:q.id,content,is_correct:q.correctAnswers.includes(content),display_order:index}));const result=await db.from("question_options").insert(options);assert(result.error)}
export async function deleteQuestion(id:string){const{error}=await createClient().from("questions").delete().eq("id",id);assert(error)}
export async function importQuestions(rows:AcademicQuestion[],entities:AcademicEntity[]){let imported=0;for(const row of rows){await saveQuestion(row,entities);imported++}return imported}
