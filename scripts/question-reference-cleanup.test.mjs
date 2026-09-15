import {readFileSync,existsSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {displayStem,confirmedSourceReferenceCount} from './question-reference-cleanup-model.mjs';
import {identity as pathId,questionPayload as pathPayload,chapterNames as pathChapters} from './pathology-import-model.mjs';
import {identity as microId,questionPayload as microPayload,chapterNames as microChapters} from './microbiology-import-model.mjs';
import {identity as bioId,sourceIdentity,questionPayload as bioPayload,chapterNames as bioChapters} from './biochemistry-import-model.mjs';
const allow=JSON.parse(readFileSync('scripts/question-reference-cleanups.json','utf8'));
const samples={
 Pathology:{file:'.local-qa/pathology-import-input.json',id:q=>pathId(q.source_key),payload:pathPayload,chapters:pathChapters},
 Microbiology:{file:'.local-qa/microbiology-preflight-records.json',id:q=>microId(q.source_key),payload:microPayload,chapters:microChapters},
 Biochemistry:{file:'.local-qa/biochemistry-preflight-records.json',id:q=>bioId(sourceIdentity(q)),payload:bioPayload,chapters:bioChapters}
};
describe.skipIf(!Object.values(samples).every(s=>existsSync(s.file)))('source-backed reference cleanup',()=>{
 it('has 154 distinct, source-hashed exact occurrences without changing their deterministic IDs or answer payload',()=>{
  expect(confirmedSourceReferenceCount).toBe(154);
  expect(new Set(allow.map(a=>a.id)).size).toBe(154);
  for(const [subject,sample] of Object.entries(samples)){
   const rows=JSON.parse(readFileSync(sample.file,'utf8'));
   const taxonomy={exam:{id:'exam'},subject:{id:'subject'},chapters:sample.chapters.map((name,i)=>({name,id:`section-${i}`}))};
   const changed=new Set(allow.filter(a=>a.subject===subject).map(a=>a.id));
   for(const q of rows.filter(q=>q.classification!=='QUARANTINE'&&!q.structural_errors?.length)){
    const id=sample.id(q),payload=sample.payload(q,taxonomy,'owner');
    if(changed.has(id)){
     const approved=allow.find(a=>a.id===id);
     expect(payload.prompt).toBe(approved.after);
     expect(payload.prompt_rich).toEqual(approved.after_rich);
     expect(payload.prompt).not.toBe(q.prompt);
     expect(q.source_sha256).toBe(approved.source_sha256);
     expect(payload.source_label).toContain(q.source_document);
    }else{
     expect(payload.prompt).toBe(q.prompt);
     expect(payload.prompt_rich).toEqual(q.prompt_rich);
    }
    expect(payload.id).toBe(id);
    expect(payload.options.map(o=>o.correct)).toEqual(q.options.map(o=>o.correct));
    expect(payload.explanation).toBe(q.explanation);
   }
  }
 });
 it('retains ratios and scientific values, and fails closed on source or rich-text mismatch',()=>{
  const q={source_document:'different.docx',source_sha256:'h',source_key:'k',source_sequence:1,prompt:'Blood pressure 120/80 and ratio 1/2',prompt_rich:{version:1,blocks:[{runs:[{text:'Blood pressure 120/80 and ratio 1/2',marks:[] }]}]}};
  expect(displayStem(q,'00000000-0000-4000-8000-000000000000','Pathology').prompt).toBe(q.prompt);
  const a=allow[0],original={source_document:a.source_document,source_sha256:a.source_sha256,source_key:a.source_identity,source_sequence:a.source_sequence,prompt:a.before,prompt_rich:a.before_rich};
  expect(()=>displayStem({...original,source_sha256:'different'},a.id,a.subject)).toThrow('checksum');
  expect(()=>displayStem({...original,prompt_rich:{version:1,blocks:[]}},a.id,a.subject)).toThrow('rich text');
 });
});
