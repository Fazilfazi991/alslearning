import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {displayStem} from './question-reference-cleanup-model.mjs';
import { identity, projectQuestion, questionSelect } from "./microbiology-import-model.mjs";
export { identity, projectQuestion, questionSelect };
export const batch = "als-biochemistry-client-20260911-v1";
export const chapterNames = ["Biochemistry of Major Biomolecules","Vitamins and Minerals, Hemoglobin","Enzymology, Techniques and Instrumentation, Biostatistics","Molecular Biology","Physical Chemistry, General Biochemistry","Clinical Biochemistry","Diagnostic Biochemistry","Hormones, QC, Toxicology"].map((n,i)=>`BIO ${i+1} — ${n}`);
export function sourceIdentity(q) {
  return createHash("sha256").update(JSON.stringify(["Biochemistry",q.bio,q.source_document,q.source_sha256,q.source_sequence])).digest("hex");
}
export function classify(q) {
  const status={"STRUCTURALLY READY":"active","CONTENT REVIEW REQUIRED":"draft",QUARANTINE:"quarantine"}[q.classification];
  assert.ok(status,"Technical blocker cannot be imported");return status;
}
export function questionPayload(q,taxonomy) {
  assert.equal(q.media.length,0,"Unexpected media: stop");
  assert.equal(sourceIdentity(q),q.scoped_source_identity,"Approved identity changed");
  assert.notEqual(classify(q),"quarantine","Quarantine is manifest-only");
  const chapter=taxonomy.chapters[q.bio-1];
  const refs=q.previous_paper_evidence;
  return {
    id:identity(sourceIdentity(q)),exam_id:taxonomy.exam.id,program_id:null,subject_id:taxonomy.subject.id,chapter_id:chapter.id,topic_id:null,
    ...displayStem(q,identity(sourceIdentity(q)),'Biochemistry'),explanation:q.explanation,explanation_rich:q.explanation_rich,type:q.type,status:classify(q),difficulty:"medium",marks:q.marks,negative_marks:q.negative_marks,
    source_type:refs.length?"previous_exam":"standard",source_reference:refs.length?refs.join(" | "):null,exam_year:null,exam_session:null,
    source_label:`${classify(q)==="draft"?"CONTENT REVIEW REQUIRED | ":""}${chapter.name} | ${q.source_document} | Q${q.source_sequence} | visible=${q.displayed_number??"absent"} | batch=${batch} | source=${q.source_key} | identity=${sourceIdentity(q)}`,
    options:q.options.map(o=>({content:o.content,content_rich:o.content_rich,correct:o.correct})),media:[],
  };
}
