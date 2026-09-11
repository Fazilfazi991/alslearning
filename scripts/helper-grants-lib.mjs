import assert from "node:assert/strict";
export const QA = "xstssknlgdraulebdsfd";
export const PRODUCTION = "dvmahmkapgtjfqmoottt";
export const migration =
  "20260911020155_explicit_core_helper_function_grants.sql";
export const publicHelpers = [
  "public.is_admin()",
  "public.is_teacher()",
  "public.has_program_access(uuid)",
  "public.teacher_has_assignment(uuid, uuid, uuid, text)",
  "public.can_join_live(uuid)",
];
export const privateHelpers = [
  "private.active_role()",
  "private.enrolled(uuid, uuid)",
  "private.content_access(uuid, boolean)",
  "private.test_access(uuid, boolean)",
  "private.teacher_batches(uuid[])",
  "private.image_access(text)",
];
export const internalHelpers = [
  "private.attempt_access(uuid)",
  "private.handle_new_user()",
  "private.rich_document_plain(jsonb, integer)",
  "private.rich_media_positions(jsonb)",
  "private.rich_plain(jsonb)",
  "private.snapshot_questions(uuid[], numeric)",
  "private.sync_profile_role()",
  "private.validate_meaningful_stem()",
  "private.validate_media_derivative()",
  "private.validate_rich_media()",
  "private.validate_taxonomy(uuid, uuid, uuid, uuid, uuid)",
];
export const authenticatedRpcs = [
  "public.core_attempt_history(uuid)",
  "public.core_attempt_payload(uuid)",
  "public.core_move_content(uuid, integer)",
  "public.core_program_subjects(uuid, uuid[])",
  "public.core_save_content(jsonb, uuid[])",
  "public.core_save_question(jsonb)",
  "public.core_save_test(jsonb, uuid[], uuid[])",
  "public.core_test_bank()",
  "public.core_test_summary(text)",
  "public.finalize_expired_test_attempts(uuid)",
  "public.get_test_review(uuid)",
  "public.save_attempt_answer(uuid, uuid, uuid[])",
  "public.set_live_presence(uuid, boolean)",
  "public.set_raised_hand(uuid, boolean)",
  "public.start_test_attempt(uuid)",
  "public.submit_test_attempt(uuid)",
];
export const canonical = [
  ...publicHelpers,
  ...privateHelpers,
  ...internalHelpers,
  ...authenticatedRpcs,
  "public.submit_checkpoint_response(uuid, uuid[])",
];
export const signature = (f) => `${f.schema}.${f.name}(${f.arguments})`;
export const catalogSql = `select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',oidvectortypes(p.proargtypes),
 'returns',pg_get_function_result(p.oid),'owner',r.rolname,'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile,
 'acl',p.proacl,'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'service_role',has_function_privilege('service_role',p.oid,'EXECUTE'),'postgres',has_function_privilege('postgres',p.oid,'EXECUTE'),
 'definition',pg_get_functiondef(p.oid)) order by n.nspname,p.proname,oidvectortypes(p.proargtypes))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
 where n.nspname in ('public','private') and p.prokind='f' and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')),
 'policies',(select jsonb_agg(to_jsonb(x)) from (select * from pg_policies where schemaname in ('public','private','storage') order by schemaname,tablename,policyname) x),
 'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r')
 ) as inventory`;
export async function management(ref, path, { method = "GET", body } = {}) {
  assert.ok(
    [QA, PRODUCTION].includes(ref),
    "Only explicitly approved ALS projects",
  );
  assert.ok(
    process.env.SUPABASE_ACCESS_TOKEN,
    "Management token required in environment",
  );
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  if (!response.ok)
    throw Error(
      `Management ${path}: ${response.status} ${await response.text()}`,
    );
  return response.json();
}
export const query = (ref, sql) =>
  management(ref, "database/query", { method: "POST", body: { query: sql } });
export function checkPrivileges(inventory) {
  const checks = [];
  for (const name of canonical) {
    const f = inventory.functions.find((f) => signature(f) === name);
    assert.ok(f, `Missing ${name}`);
    const auth = [
      ...publicHelpers,
      ...privateHelpers,
      ...authenticatedRpcs,
    ].includes(name);
    for (const [role, expected] of [
      ["anon", false],
      ["authenticated", auth],
      ["postgres", true],
    ]) {
      assert.equal(f[role], expected, `${name}: ${role}`);
      checks.push(`${name}: ${role}=${expected}`);
    }
    if (
      [...publicHelpers, ...privateHelpers, ...internalHelpers].includes(name)
    ) {
      assert.equal(f.service_role, false, `${name}: service_role`);
      checks.push(`${name}: service_role=false`);
    }
    assert.equal(f.owner, "postgres", `${name} owner`);
    assert.deepEqual(f.config, ['search_path=""'], `${name} safe search_path`);
    checks.push(`${name}: postgres owner and empty search_path`);
    const invokers = [
      "public.is_admin()",
      "public.is_teacher()",
      "public.can_join_live(uuid)",
      "private.rich_document_plain(jsonb, integer)",
      "private.rich_media_positions(jsonb)",
      "private.rich_plain(jsonb)",
    ];
    assert.equal(f.definer, !invokers.includes(name), `${name} security mode`);
    checks.push(`${name}: security mode preserved`);
    if ([...publicHelpers, ...privateHelpers].includes(name)) {
      assert.equal(f.volatility, "s", `${name} stable access helper`);
      checks.push(`${name}: STABLE`);
    }
  }
  assert.ok(
    inventory.tables.every((t) => t.rls),
    "RLS enabled on all canonical application tables",
  );
  checks.push("RLS enabled on all canonical application tables");
  return checks;
}
