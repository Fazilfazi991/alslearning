import fs from 'node:fs';
import assert from 'node:assert/strict';
import {query,QA,PRODUCTION,catalogSql} from './helper-grants-lib.mjs';
import {createHash} from 'node:crypto';
const stage=process.argv[2]??'before';
const tables=['questions','question_options','question_answer_keys','question_media','recorded_classes','enrollments','program_subjects','learning_content'];
const sql=tables.map(t=>`select '${t}' name,count(*) count,md5(coalesce(string_agg(to_jsonb(r)::text,'' order by to_jsonb(r)::text),'')) hash from public.${t} r`).join(' union all ');
const result={};
for(const ref of [QA,PRODUCTION]){
 const [fingerprints,recordings,security]=await Promise.all([query(ref,sql),query(ref,`select r.id,r.title,r.status,r.topic_label,r.subtopic,s.name subject from public.recorded_classes r join public.subjects s on s.id=r.subject_id order by s.name,r.title`),query(ref,catalogSql)]);
 result[ref]={fingerprints,recordings,securityHash:createHash('sha256').update(JSON.stringify(security)).digest('hex')};
}
fs.writeFileSync(`docs/student-courses-data-${stage}.json`,JSON.stringify(result,null,2)+'\n');
if(stage!=='before')assert.deepEqual(result,JSON.parse(fs.readFileSync('docs/student-courses-data-before.json')));
console.log(JSON.stringify({stage,unchanged:stage!=='before',recordings:Object.fromEntries(Object.entries(result).map(([ref,value])=>[ref,value.recordings]))}));
