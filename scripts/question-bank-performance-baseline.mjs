// Read-only content fingerprints and query measurements. Never imports or saves content.
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {query,QA,PRODUCTION} from './helper-grants-lib.mjs';
import {productionImportClients} from './production-import-client.mjs';
const stage=process.argv[2]||'before';
const contentSql=['questions','question_options','question_answer_keys','question_media','subjects','chapters'].map(t=>`select '${t}' name,count(*) count,md5(coalesce(string_agg(to_jsonb(r)::text,'' order by to_jsonb(r)::text),'')) hash from public.${t} r`).join(' union all ');
const fingerprints={};
for(const ref of [QA,PRODUCTION]) fingerprints[ref]={content:await query(ref,contentSql),counts:await query(ref,`select s.name,q.status,count(*) from public.questions q join public.subjects s on s.id=q.subject_id group by s.name,q.status order by s.name,q.status`)};
fingerprints.manifests=Object.fromEntries(['pathology','microbiology','biochemistry'].map(s=>{const p=`docs/production-${s}-quarantine.json`;return[p,existsSync(p)?createHash('sha256').update(readFileSync(p)).digest('hex'):null];}));
writeFileSync(`docs/question-bank-content-${stage}.json`,JSON.stringify(fingerprints,null,2)+'\n');
console.log('Fingerprints captured',Object.fromEntries([QA,PRODUCTION].map(ref=>[ref,fingerprints[ref].counts])));
if(stage!=='before')process.exit(0);
const {admin}=await productionImportClients();
const measurements=[];
async function time(name,work){const start=performance.now();const result=await work();if(result.error)throw result.error;measurements.push({name,ms:Math.round(performance.now()-start),rows:Array.isArray(result.data)?result.data.length:undefined,bytes:Buffer.byteLength(JSON.stringify(result.data)),count:result.count});return result.data;}
await time('auth/getUser',()=>admin.auth.getUser());
await time('profile',()=>admin.from('profiles').select('role,is_active').eq('id','0a4b8cc3-c796-4765-8973-78225e366a4d').single());
await Promise.all(['subjects','chapters','entrance_exams','programs','topics','batches','faculty_assignments','program_subjects'].map(t=>time(t,()=>admin.from(t).select('*'))));
await time('unrelated tests',()=>admin.from('tests').select('*,test_questions(question_id),test_batches(batch_id)'));
await time('unrelated learning content',()=>admin.from('learning_content').select('*,content_batch_access(batch_id)'));
await time('unrelated teacher bank',()=>admin.rpc('core_test_bank'));
const full='*,question_options!question_options_question_id_fkey(id,content,content_rich,display_order),question_answer_keys(option_id),question_media(*)';
const start=performance.now();let all=[];
for(let offset=0;;offset+=500){const rows=await time(`full questions ${offset}`,()=>admin.from('questions').select(full).order('created_at',{ascending:false}).range(offset,offset+499));all.push(...rows);if(rows.length<500)break;}
const totalMs=Math.round(performance.now()-start);
for(const [name,columns] of [['plain list','id,prompt,subject_id,chapter_id,status,type,marks,source_label,source_reference,created_at'],['options','id,question_options!question_options_question_id_fkey(id,content,content_rich,display_order)'],['answer keys','id,question_answer_keys(option_id)'],['rich/explanation/tables','id,prompt_rich,explanation,explanation_rich'],['media','id,question_media(*)']])await time(name+' 500',()=>admin.from('questions').select(columns).order('created_at',{ascending:false}).range(0,499));
await time('exact count',()=>admin.from('questions').select('id',{head:true,count:'exact'}));
const report={project:PRODUCTION,at:new Date().toISOString(),kind:'Authenticated Admin API decomposition; not browser rendering timings',measurements,totalFullBankMs:totalMs,totalRows:all.length,totalBytes:Buffer.byteLength(JSON.stringify(all))};
writeFileSync('docs/question-bank-api-before.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
await admin.auth.signOut({scope:'local'});
