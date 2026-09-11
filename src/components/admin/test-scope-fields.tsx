"use client";
import type {CoreData,Test} from "@/lib/core-repository";
import {canManage} from "@/lib/core-repository";
import {eligibleTestQuestions,testScopes,type SubjectScope} from "@/lib/test-question-scope";
import {Select,TaxonomyFields,fieldClass,Field} from "./core-fields";
export function TestScopeFields({value:t,data,onChange}:{value:Test;data:CoreData;onChange:(t:Test)=>void}) {
 const multi=!!t.selection_rules.scopes;
 function scopes(next:SubjectScope[]) {onChange({...t,subject_id:"",chapter_id:"",topic_id:"",selection_rules:{...t.selection_rules,scopes:next},question_count:next.reduce((n,s)=>n+(s.count||0),0)});}
 const subjects=data.subjects.filter(s=>data.mappings.some(m=>m.program_id===t.program_id&&m.subject_id===s.id)&&canManage(data,"tests",{...t,subject_id:s.id}));
 return <div className="space-y-4">
  <Select label="Academic scope mode" required value={multi?"multiple":"single"} items={[{id:"single",name:"Single subject"},{id:"multiple",name:"Multiple subjects"}]} onChange={v=>{
   if(v==="multiple")scopes(testScopes(t).map(s=>({...s,count:1})));
   else {const first=testScopes(t)[0];const {scopes:removed,...rules}=t.selection_rules;void removed;onChange({...t,subject_id:first?.subject_id||"",chapter_id:first?.chapter_ids.length===1?first.chapter_ids[0]:"",selection_rules:rules,question_count:1});}
  }}/>
  {!multi?<TaxonomyFields value={t} data={data} programRequired sectionMode onChange={v=>onChange({...t,...v,batch_ids:t.program_id===v.program_id?t.batch_ids:[]})}/>:<>
   <div className="grid gap-3 sm:grid-cols-2">
    <Select label="Entrance exam" required value={t.exam_id} items={data.exams} onChange={exam_id=>onChange({...t,exam_id,program_id:"",batch_ids:[],selection_rules:{...t.selection_rules,scopes:[]}})}/>
    <Select label="Program" required value={t.program_id} items={data.programs.filter(p=>!p.exam_id||p.exam_id===t.exam_id)} onChange={program_id=>onChange({...t,program_id,batch_ids:[],selection_rules:{...t.selection_rules,scopes:[]}})}/>
   </div>
   <Select label="Add subject" value="" items={subjects.filter(s=>!t.selection_rules.scopes?.some(x=>x.subject_id===s.id))} onChange={subject_id=>{if(subject_id)scopes([...testScopes(t),{subject_id,chapter_ids:[],count:1}]);}}/>
   {testScopes(t).map(scope=>{
    const name=data.subjects.find(s=>s.id===scope.subject_id)?.name||"Subject";
    const sections=data.chapters.filter(c=>c.subject_id===scope.subject_id&&(!c.program_id||c.program_id===t.program_id));
    const available=eligibleTestQuestions(data,t).filter(q=>q.subject_id===scope.subject_id).length;
    const change=(v:SubjectScope)=>scopes(testScopes(t).map(s=>s.subject_id===v.subject_id?v:s));
    return <section key={scope.subject_id} className="min-w-0 space-y-3 rounded-lg border border-line p-3" aria-label={name+" scope"}>
     <div className="flex items-center justify-between gap-2"><strong>{name}</strong><button type="button" className="min-h-11 px-2 text-sm text-brand" aria-label={"Remove "+name} onClick={()=>scopes(testScopes(t).filter(s=>s.subject_id!==scope.subject_id))}>Remove</button></div>
     <p className="text-sm">Available Active Questions: {available}</p>
     <details><summary className="min-h-11 cursor-pointer text-sm">{scope.chapter_ids.length?scope.chapter_ids.length+" selected sections":"All sections"}</summary>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!scope.chapter_ids.length} onChange={()=>change({...scope,chapter_ids:[]})}/>All sections</label>
      {sections.map(c=><label key={c.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={scope.chapter_ids.includes(c.id)} onChange={e=>change({...scope,chapter_ids:e.target.checked?[...scope.chapter_ids,c.id]:scope.chapter_ids.filter(id=>id!==c.id)})}/>{c.name}</label>)}
     </details>
     {t.selection_mode==="generated"&&<Field label={name+" question count"}><input className={fieldClass} type="number" min={1} max={available||undefined} disabled={!available} value={scope.count??1} onChange={e=>change({...scope,count:Number(e.target.value)})}/></Field>}
    </section>;
   })}
  </>}
 </div>;
}
