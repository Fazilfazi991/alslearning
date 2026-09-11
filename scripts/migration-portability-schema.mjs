import assert from "node:assert/strict";

export const schemaSql = `select jsonb_build_object(
 'columns',(select jsonb_agg(to_jsonb(x) order by x.table_schema,x.table_name,x.ordinal_position) from (select table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema in ('public','private')) x),
 'indexes',(select jsonb_agg(to_jsonb(x) order by x.schemaname,x.tablename,x.indexname) from (select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('public','private')) x),
 'constraints',(select jsonb_agg(to_jsonb(x) order by x.schema,x.table_name,x.name) from (select n.nspname as schema,c.relname as table_name,k.conname as name,k.contype as type,pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')) x)
) as structure`;

export function compareStructure(actual, expected) {
  const checks = [];
  for (const group of ["columns", "indexes", "constraints"]) {
    assert.deepEqual(actual[group], expected[group], `${group} match clean replay`);
    checks.push(`${actual[group].length} ${group} match clean replay`);
  }
  return checks;
}
