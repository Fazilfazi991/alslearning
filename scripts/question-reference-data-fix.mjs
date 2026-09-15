import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {query,QA,PRODUCTION} from './helper-grants-lib.mjs';
const [target,mode]=process.argv.slice(2);
assert.ok(['qa','production'].includes(target)&&['dry-run','apply'].includes(mode),'target qa|production, mode dry-run|apply');
if(!process.env.SUPABASE_ACCESS_TOKEN){const m=readFileSync('.env.local','utf8').match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m);if(m)process.env.SUPABASE_ACCESS_TOKEN=m[1].trim().replace(/^['"]|['"]$/g,'');}
const root='.local-qa/batch3',ref=target==='qa'?QA:PRODUCTION;
assert.ok(existsSync(`${root}/classified.json`)&&existsSync(`${root}/${target}-before-protection.json`),'Audit and before-hash artifacts required');
if(target==='production')assert.ok(existsSync(`${root}/qa-after-protection.json`),'QA validation required before Production');
const allow=JSON.parse(readFileSync('scripts/question-reference-cleanups.json','utf8'));
const bank=JSON.parse(readFileSync(`${root}/${target}-bank.json`,'utf8'));
const byId=new Map(bank.map(q=>[q.id,q]));
const payload=allow.map(a=>{
 const q=byId.get(a.id);
 assert.ok(q&&q.prompt===a.before&&JSON.stringify(q.prompt_rich)===JSON.stringify(a.before_rich),`Source baseline mismatch ${a.id}`);
 assert.equal(q.source_label.includes(a.source_document),true,`Source document mismatch ${a.id}`);
 return {id:a.id,before:a.before,after:a.after,before_rich:a.before_rich,after_rich:a.after_rich,source_label:q.source_label,status:q.status};
});
assert.equal(payload.length,154);
const backup=allow.map(a=>({...a,source_label:byId.get(a.id).source_label,status:byId.get(a.id).status,updated_at:byId.get(a.id).updated_at,reason:'Confirmed source/exam metadata, original DOCX verified'}));
const quoted=JSON.stringify(payload);
assert.equal(quoted.includes('$als_batch3_payload$'),false);
const source=`jsonb_to_recordset($als_batch3_payload$${quoted}$als_batch3_payload$::jsonb) as x(id uuid,before text,after text,before_rich jsonb,after_rich jsonb,source_label text,status public.record_status)`;
const checks=`select count(*)::integer total,
 count(*) filter (where q.prompt=x.before and q.prompt_rich=x.before_rich)::integer pending,
 count(*) filter (where q.prompt=x.after and q.prompt_rich=x.after_rich)::integer already_done,
 count(*) filter (where q.source_label<>x.source_label or q.status<>x.status or (q.prompt<>x.before or q.prompt_rich<>x.before_rich) and (q.prompt<>x.after or q.prompt_rich<>x.after_rich))::integer mismatched
 from ${source} left join public.questions q on q.id=x.id`;
const [pre]=await query(ref,checks);
assert.equal(pre.total,154);assert.equal(pre.mismatched,0,'Refuse changed identities, source, status or unexpected text');
assert.equal(pre.pending+pre.already_done,154);
if(mode==='dry-run'){console.log(target,mode,pre);process.exit(0);}
writeFileSync(`${root}/${target}-rollback.json`,JSON.stringify(backup,null,2));
const sql=`begin;
 do $als_batch3_update$
 declare original_count integer; revised_count integer; bad_count integer; changed integer;
 begin
  select total,pending,mismatched into original_count,revised_count,bad_count from (${checks}) counts;
  if original_count<>154 or bad_count<>0 then raise exception 'Batch3 source precondition failed'; end if;
  update public.questions q set prompt=x.after,prompt_rich=x.after_rich from ${source}
  where q.id=x.id and q.source_label=x.source_label and q.status=x.status
  and q.prompt=x.before and q.prompt_rich=x.before_rich;
  get diagnostics changed=row_count;
  if changed<>revised_count then raise exception 'Batch3 changed % rows, expected %',changed,revised_count; end if;
 end $als_batch3_update$;
 select total,pending,already_done,mismatched from (${checks}) result;
 commit;`;
writeFileSync(`${root}/${target}-data-fix.sql`,sql);
const rows=await query(ref,sql);
const post=rows.find(r=>r?.already_done!==undefined);
assert.ok(post,'Expected post-update confirmation');assert.deepEqual(post,{total:154,pending:0,already_done:154,mismatched:0});
console.log(target,mode,{changed:pre.pending,already_done:pre.already_done,...post});
