import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {query,QA} from './helper-grants-lib.mjs';
if(!process.env.SUPABASE_ACCESS_TOKEN){
 const match=readFileSync('.env.local','utf8').match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m);
 if(match)process.env.SUPABASE_ACCESS_TOKEN=match[1].trim().replace(/^['"]|['"]$/g,'');
}
const teacher='081554cd-fe9d-4df0-a5bb-60c2ba0d93c9';
const exam='f98f503c-cf40-4b2e-a79d-5e29e58714e1';
const program='a5a7ea69-8256-4122-89e7-bf4ebd48f84a';
const wrongProgram='a24cc2c7-47f6-4b1b-8a00-12722521adcc';
const subject='70cc2625-ed83-41b9-b0cc-02fa4b416e0d';
const unassigned='44a74404-4d31-422c-b6c1-cdeee5826d82';
const wrongExam='00000000-0000-4000-8000-000000000001';
const [acl]=await query(QA,`select
 has_function_privilege('anon','private.teacher_question_read_scope(uuid,uuid,uuid)','EXECUTE') as anon,
 has_function_privilege('authenticated','private.teacher_question_read_scope(uuid,uuid,uuid)','EXECUTE') as authenticated,
 has_function_privilege('service_role','private.teacher_question_read_scope(uuid,uuid,uuid)','EXECUTE') as service_role,
 (select prosecdef from pg_proc where oid='private.teacher_question_read_scope(uuid,uuid,uuid)'::regprocedure) as definer`);
assert.deepEqual(acl,{anon:false,authenticated:true,service_role:false,definer:true});
const [taxonomyAcl]=await query(QA,`select
 has_function_privilege('anon','private.teacher_question_taxonomy_read(uuid,uuid)','EXECUTE') as anon,
 has_function_privilege('authenticated','private.teacher_question_taxonomy_read(uuid,uuid)','EXECUTE') as authenticated,
 has_function_privilege('service_role','private.teacher_question_taxonomy_read(uuid,uuid)','EXECUTE') as service_role,
 (select prosecdef from pg_proc where oid='private.teacher_question_taxonomy_read(uuid,uuid)'::regprocedure) as definer`);
assert.deepEqual(taxonomyAcl,{anon:false,authenticated:true,service_role:false,definer:true});
const f=(ex,pr,su)=>`private.teacher_question_read_scope(${ex?`'${ex}'`:'null'}::uuid,${pr?`'${pr}'`:'null'}::uuid,${su?`'${su}'`:'null'}::uuid)`;
const sql=`begin;
 select set_config('request.jwt.claim.sub','${teacher}',true);
 set local role authenticated;
 select jsonb_build_object(
 'canonical_assigned',${f(exam,null,subject)},
 'explicit_matching',${f(exam,program,subject)},
 'explicit_wrong_program',${f(exam,wrongProgram,subject)},
 'right_program_wrong_subject',${f(exam,program,unassigned)},
 'unassigned_subject',${f(exam,null,unassigned)},
 'wrong_exam',${f(wrongExam,null,subject)},
 'no_subject',${f(exam,null,null)},
 'authoring_helper_canonical',public.teacher_has_assignment('${exam}'::uuid,null::uuid,'${subject}'::uuid,'questions'),
 'authoring_helper_explicit_matching',public.teacher_has_assignment('${exam}'::uuid,'${program}'::uuid,'${subject}'::uuid,'questions'),
 'authoring_helper_explicit_wrong_program',public.teacher_has_assignment('${exam}'::uuid,'${wrongProgram}'::uuid,'${subject}'::uuid,'questions')
 ,'assigned_exam_metadata',private.teacher_question_taxonomy_read('${exam}'::uuid,null::uuid)
 ,'assigned_program_metadata',private.teacher_question_taxonomy_read(null::uuid,'${program}'::uuid)
 ,'unassigned_exam_metadata',private.teacher_question_taxonomy_read('${wrongExam}'::uuid,null::uuid)
 ,'unassigned_program_metadata',private.teacher_question_taxonomy_read(null::uuid,'${wrongProgram}'::uuid)
 ) as checks;
 rollback;`;
const rows=await query(QA,sql);
const checks=rows[0].checks;
assert.deepEqual(checks,{
 no_subject:false,wrong_exam:false,explicit_matching:true,right_program_wrong_subject:false,
 canonical_assigned:true,unassigned_subject:false,
 explicit_wrong_program:false,authoring_helper_canonical:false,
 authoring_helper_explicit_matching:true,authoring_helper_explicit_wrong_program:false,
 assigned_exam_metadata:true,assigned_program_metadata:true,
 unassigned_exam_metadata:false,unassigned_program_metadata:false
});
const ids={canonical:'00000000-0000-4000-8000-000000000101',matching:'00000000-0000-4000-8000-000000000102',wrong:'00000000-0000-4000-8000-000000000103',unassigned:'00000000-0000-4000-8000-000000000104',rightProgramWrongSubject:'00000000-0000-4000-8000-000000000105'};
const fixtureSql=`begin;
 insert into public.questions(id,exam_id,program_id,subject_id,type,prompt,status)
 values
 ('${ids.canonical}','${exam}',null,'${subject}','single_mcq','QA transaction canonical','active'),
 ('${ids.matching}','${exam}','${program}','${subject}','single_mcq','QA transaction matching','active'),
 ('${ids.wrong}','${exam}','${wrongProgram}','${subject}','single_mcq','QA transaction wrong Program','active'),
 ('${ids.unassigned}','${exam}',null,'${unassigned}','single_mcq','QA transaction unassigned','active'),
 ('${ids.rightProgramWrongSubject}','${exam}','${program}','${unassigned}','single_mcq','QA transaction right Program wrong Subject','active');
 select set_config('request.jwt.claim.sub','${teacher}',true);
 set local role authenticated;
 select jsonb_build_object(
 'canonical',(select count(*) from public.questions where id='${ids.canonical}'),
 'explicit_matching',(select count(*) from public.questions where id='${ids.matching}'),
 'explicit_wrong_program',(select count(*) from public.questions where id='${ids.wrong}'),
 'unassigned_subject',(select count(*) from public.questions where id='${ids.unassigned}'),
 'right_program_wrong_subject',(select count(*) from public.questions where id='${ids.rightProgramWrongSubject}')
 ) as fixture_visibility;
 rollback;`;
const fixture=(await query(QA,fixtureSql))[0].fixture_visibility;
assert.deepEqual(fixture,{canonical:1,explicit_matching:1,explicit_wrong_program:0,unassigned_subject:0,right_program_wrong_subject:0});
const remaining=(await query(QA,`select count(*)::integer as count from public.questions where id in ('${Object.values(ids).join("','")}')`))[0].count;
assert.equal(remaining,0,'Disposable QA fixtures fully rolled back');
const guarded=`begin;
 select set_config('request.jwt.claim.sub','${teacher}',true);
 update public.faculty_assignments set can_manage_questions=false where faculty_id='${teacher}' and subject_id='${subject}';
 set local role authenticated;
 select count(*)::integer as count from public.questions where subject_id='${subject}';
 rollback;`;
const permissionOff=(await query(QA,guarded))[0].count;
assert.equal(permissionOff,0,'can_manage_questions=false denies Subject');
const inactiveSql=`begin;
 select set_config('request.jwt.claim.sub','${teacher}',true);
 update public.profiles set is_active=false where id='${teacher}';
 set local role authenticated;
 select count(*)::integer as count from public.questions where subject_id='${subject}';
 rollback;`;
const inactive=(await query(QA,inactiveSql))[0].count;
assert.equal(inactive,0,'Inactive Teacher denied');
console.log(JSON.stringify({checks,fixture,permissionOff,inactive,fixturesCleaned:true}));
