import { readFileSync } from "node:fs";
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
  ".",
)[0];
if (process.env.CORE_QA_PROJECT_REF !== ref)
  throw new Error("Explicit QA project confirmation required");
if (!process.env.SUPABASE_ACCESS_TOKEN)
  throw new Error("Management token required");
const file = process.argv[2];
let query = readFileSync(file, "utf8");
if (process.argv.includes("--apply")) {
  if (process.env.CORE_QA_PROJECT_REF !== ref)
    throw new Error(
      "Set CORE_QA_PROJECT_REF to the explicitly approved QA project. Never run against production.",
    );
  const name = file.replaceAll("\\", "/").split("/").pop().replace(".sql", "");
  const version = name.split("_")[0];
  query = `begin;\n${query}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name.slice(15)}',array['${query.replaceAll("'", "''")}']);\ncommit;`;
}
const response = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  },
);
const result = await response.text();
console.log(response.status, result);
if (!response.ok) process.exitCode = 1;
