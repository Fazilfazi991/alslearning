// Synthetic SQL authorization probes: all fixture writes are rolled back.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { query, QA, PRODUCTION } from "./helper-grants-lib.mjs";
const target = process.argv[2];
assert.ok([QA, PRODUCTION, "local"].includes(target));
async function execute(sql) {
  if (target !== "local") return query(target, sql);
  assert.match(process.env.ALS_TEST_PGDATABASE || "", /^als_grants_\d+$/);
  assert.ok(process.env.ALS_TEST_PSQL);
  assert.match(process.env.ALS_TEST_PGPORT || "", /^\d{4,5}$/);
  const result = spawnSync(process.env.ALS_TEST_PSQL, ["-h","127.0.0.1","-p",process.env.ALS_TEST_PGPORT,"-U","postgres","-d",process.env.ALS_TEST_PGDATABASE,"-X","-q","-t","-A","-v","ON_ERROR_STOP=1"], {input:sql,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);
  return [{count:Number(result.stdout.trim())}];
}
const ids = Object.fromEntries(["admin", "teacher", "student", "program", "otherProgram", "batch", "otherBatch", "content", "test", "enrollment"].map((name) => [name, randomUUID()]));
const literal = (s) => `'${s.replaceAll("'", "''")}'`;
const id = (name) => `${literal(ids[name])}::uuid`;
const prefix = `portability-${randomUUID()}`;
const commands = ["begin;"];
const checks = [];
const check = (name, expression) => {
  commands.push(`do $probe$ begin if (${expression}) is distinct from true then raise exception ${literal(name)}; end if; end $probe$;`);
  checks.push(name);
};
const denied = (name, sql, pattern = "permission denied") => {
  commands.push(`do $probe$ declare denied boolean := false; begin begin ${sql}; exception when others then if position(${literal(pattern)} in lower(sqlerrm)) > 0 then denied := true; else raise; end if; end; if not denied then raise exception ${literal(name)}; end if; end $probe$;`);
  checks.push(name);
};
const asUser = (name) => commands.push(`reset role; select set_config('request.jwt.claim.sub',${literal(ids[name])},true), set_config('request.jwt.claims',${literal(JSON.stringify({sub: ids[name], role: "authenticated"}))},true); set local role authenticated;`);
for (const name of ["admin", "teacher", "student"]) commands.push(`insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values (${id(name)},${literal(`${prefix}-${name}@example.invalid`)},${literal(JSON.stringify({role:name}))}::jsonb,'{}');`);
for (const name of ["program", "otherProgram"]) commands.push(`insert into public.programs(id,slug,name,status) values (${id(name)},${literal(`${prefix}-${name}`)},'Disposable authorization probe','active');`);
for (const name of ["batch", "otherBatch"]) commands.push(`insert into public.batches(id,program_id,slug,name,status) values (${id(name)},${id("program")},${literal(`${prefix}-${name}`)},'Disposable authorization probe','active');`);
commands.push(`insert into public.enrollments(id,student_id,program_id,batch_id) values (${id("enrollment")},${id("student")},${id("program")},${id("batch")});
insert into public.learning_content(id,program_id,kind,slug,title,status) values (${id("content")},${id("program")},'note',${literal(`${prefix}-content`)},'Disposable probe','active');
insert into public.content_batch_access values (${id("content")},${id("batch")});
insert into public.tests(id,program_id,slug,title,type,question_count,duration_minutes,status) values (${id("test")},${id("program")},${literal(`${prefix}-test`)},'Disposable probe','mock',1,5,'active');
insert into public.test_batches values (${id("test")},${id("batch")});
insert into public.faculty_assignments(faculty_id,program_id,can_manage_content,can_manage_tests) values (${id("teacher")},${id("program")},true,true);
insert into public.batch_faculty values (${id("batch")},${id("teacher")});`);
asUser("admin");
check("Admin helper executes", "public.is_admin()");
check("Admin content policy", `exists(select 1 from public.learning_content where id=${id("content")})`);
asUser("teacher");
check("Teacher helper executes", "public.is_teacher()");
check("Teacher assigned content policy", `exists(select 1 from public.learning_content where id=${id("content")})`);
check("Teacher assigned test policy", `exists(select 1 from public.tests where id=${id("test")})`);
check("Teacher wrong program denied", `not public.teacher_has_assignment(null,${id("otherProgram")},null,'content')`);
check("Teacher question permission denied", `not public.teacher_has_assignment(null,${id("program")},null,'questions')`);
check("Teacher unassigned batch denied", `not private.teacher_batches(array[${id("otherBatch")}])`);
denied("Teacher unauthorized question RPC", "perform public.core_save_question('{}')");
denied("Teacher unscoped test RPC", "perform public.core_save_test('{}','{}','{}')");
asUser("student");
check("Student not admin", "not public.is_admin()");
check("Student eligible content", `exists(select 1 from public.learning_content where id=${id("content")})`);
check("Student eligible test", `exists(select 1 from public.tests where id=${id("test")})`);
check("Student wrong program", `not private.enrolled(${id("otherProgram")})`);
check("Student wrong batch", `not private.enrolled(${id("program")},${id("otherBatch")})`);
denied("Student question authoring denied", "perform public.core_save_question('{}')");
denied("Student test authoring denied", "perform public.core_save_test('{}','{}','{}')");
check("Direct attempt inserts denied", "not has_table_privilege(current_user,'public.test_attempts','INSERT')");
for (const column of ["score", "status", "submitted_at"]) check(`Direct ${column} mutation denied`, `not has_column_privilege(current_user,'public.test_attempts',${literal(column)},'UPDATE')`);
check("Owner-only grading snapshot helper denied", "not has_function_privilege(current_user,'private.snapshot_questions(uuid[],numeric)','EXECUTE')");
for (const [name, change] of [
  ["future", "access_starts_at=now()+interval '1 day'"],
  ["expired", "access_starts_at=now()-interval '2 days',access_expires_at=now()-interval '1 day'"],
  ["suspended", "access_expires_at=null,status='suspended'"],
]) {
  commands.push(`reset role; update public.enrollments set ${change} where id=${id("enrollment")};`);
  asUser("student");
  check(`${name} content denied`, `not exists(select 1 from public.learning_content where id=${id("content")})`);
  check(`${name} test denied`, `not exists(select 1 from public.tests where id=${id("test")})`);
}
commands.push(`reset role; update public.enrollments set status='active' where id=${id("enrollment")}; update public.profiles set is_active=false where id=${id("student")};`);
asUser("student");
check("Inactive student content denied", `not exists(select 1 from public.learning_content where id=${id("content")})`);
check("Inactive student test denied", `not exists(select 1 from public.tests where id=${id("test")})`);
commands.push("reset role; select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true); set local role anon;");
denied("Anon helper denied", "perform public.is_admin()");
for (const table of ["questions", "question_answer_keys", "test_attempts", "learning_content"]) {
  commands.push(`do $probe$ declare visible bigint:=0; begin begin select count(*) into visible from public.${table}; exception when insufficient_privilege then visible:=0; end; if visible<>0 then raise exception 'Anonymous data exposure'; end if; end $probe$;`);
  checks.push(`Anon ${table}: no visible data (RLS or privilege denial)`);
}
commands.push(`reset role; select ${checks.length} as passed; rollback;`);
await execute(commands.join("\n"));
const residual = (await execute(`select count(*) as count from auth.users where email like ${literal(`${prefix}%`)}`))[0].count;
assert.equal(Number(residual), 0, "No disposable accounts remain");
writeFileSync(`.local-qa/helper-grants/${target}-portability-authorization.json`, JSON.stringify({target,checks,rolledBack:true,residualAccounts:Number(residual)}, null, 2));
console.log(`PASS ${target}: ${checks.length} authorization assertions; fixtures rolled back`);
