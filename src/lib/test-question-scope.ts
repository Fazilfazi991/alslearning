import type { CoreData, Test } from "./core-repository";
export type SubjectScope = {subject_id:string;chapter_ids:string[];count?:number};
export function testScopes(t:Test):SubjectScope[] {
 return t.selection_rules?.scopes ?? (t.subject_id?[{subject_id:t.subject_id,chapter_ids:t.chapter_id?[t.chapter_id]:[]}]:[]);
}
export function inferTestScope(data:CoreData,t:Test):Test {
 if(t.subject_id || t.selection_rules?.scopes || !t.question_ids.length)return t;
 const selected=data.questions.filter(q=>t.question_ids.includes(q.id));
 const subjects=[...new Set(selected.map(q=>q.subject_id))];
 if(!subjects.length)return t;
 const scopes=subjects.map(subject_id=>({subject_id,chapter_ids:[...new Set(selected.filter(q=>q.subject_id===subject_id).map(q=>q.chapter_id).filter(Boolean))],count:selected.filter(q=>q.subject_id===subject_id).length}));
 if(subjects.length===1)return {...t,subject_id:subjects[0],chapter_id:scopes[0].chapter_ids.length===1?scopes[0].chapter_ids[0]:""};
 return {...t,selection_rules:{...t.selection_rules,scopes}};
}
export function hasTestScope(data: CoreData, test: Test) {
 const scopes=testScopes(test);
 return !!test.exam_id && !!test.program_id && scopes.length>0 &&
 new Set(scopes.map(s=>s.subject_id)).size===scopes.length &&
 scopes.every(scope=>data.subjects.some(s=>s.id===scope.subject_id) &&
 data.mappings.some(m=>m.program_id===test.program_id && m.subject_id===scope.subject_id) &&
 scope.chapter_ids.every(id=>data.chapters.some(c=>c.id===id && c.subject_id===scope.subject_id && (!c.program_id||c.program_id===test.program_id)))) &&
 (!test.topic_id || data.topics.some(topic=>topic.id===test.topic_id && topic.subject_id===test.subject_id && (!test.chapter_id||topic.chapter_id===test.chapter_id)));
}
export function eligibleTestQuestions(data: CoreData, test: Test) {
 if(!hasTestScope(data,test))return [];
 return data.questions.filter(q=>q.status==="active" && q.type!=="match_following" && q.exam_id===test.exam_id &&
 (!q.program_id||q.program_id===test.program_id) &&
 testScopes(test).some(s=>q.subject_id===s.subject_id && (!s.chapter_ids.length||s.chapter_ids.includes(q.chapter_id))) &&
 (!test.topic_id||q.topic_id===test.topic_id) &&
 (test.selection_mode!=="generated"||!test.selection_rules?.difficulty||q.difficulty===test.selection_rules.difficulty));
}
export function retainAllowedSelections(data:CoreData,t:Test):Test {
 const allowed=new Set(eligibleTestQuestions(data,{...t,selection_mode:"manual"}).map(q=>q.id));
 return {...t,question_ids:t.question_ids.filter(id=>allowed.has(id))};
}
export function testSelectionError(data:CoreData,t:Test,state:"loading"|"ready"|"error"="ready"):string|null {
 if(state==="loading")return "Loading current question availability…";
 if(state==="error")return "Question availability could not be loaded. Retry before saving.";
 if(!hasTestScope(data,t))return "Choose a subject and a valid section within the program first.";
 const eligible=eligibleTestQuestions(data,t);
 if(!eligible.length)return "No active questions are available for this scope.";
 if(t.selection_mode==="generated"){
  if(t.selection_rules.scopes){
   for(const s of t.selection_rules.scopes){
    const count=eligible.filter(q=>q.subject_id===s.subject_id).length;
    if(!count)return "No active questions are available for this scope.";
    if(!Number.isInteger(s.count)||!s.count||s.count<1||s.count>count)return `Choose 1–${count} questions for ${data.subjects.find(x=>x.id===s.subject_id)?.name}.`;
   }
   return null;
  }
  return Number.isInteger(t.question_count)&&t.question_count>0&&t.question_count<=eligible.length?null:`Choose between 1 and ${eligible.length} available active questions.`;
 }
 return t.question_ids.length>0 && new Set(t.question_ids).size===t.question_ids.length && t.question_ids.every(id=>eligible.some(q=>q.id===id))?null:"Select active questions from this scope; remove any unavailable selections.";
}
