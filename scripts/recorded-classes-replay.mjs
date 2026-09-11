// Fresh, isolated local PostgreSQL only. Never accepts a remote host.
import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
const exe=process.env.ALS_TEST_PSQL, port=process.env.ALS_TEST_PGPORT;
assert.ok(exe && port,"Set ALS_TEST_PSQL and ALS_TEST_PGPORT for an isolated local PostgreSQL cluster");
assert.match(port,/^\d{4,5}$/);
const database=`recorded_replay_${Date.now()}`;
function run(sql,db=database){const r=spawnSync(exe,["-h","127.0.0.1","-p",port,"-U","postgres","-d",db,"-X","-q","-t","-A","-v","ON_ERROR_STOP=1"],{input:sql,encoding:"utf8"});if(r.status)throw Error(r.stderr);return r.stdout.trim();}
const report={applied:[],error:null};run(`create database ${database}`,"postgres");
try{
 run(fs.readFileSync("scripts/fixtures/helper-grants-provider.sql","utf8"));
 for(const file of fs.readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort()){
  run("begin;"+fs.readFileSync("supabase/migrations/"+file,"utf8")+"commit;");report.applied.push(file);
 }
 assert.equal(run("select count(*) from pg_class where relname in ('recorded_classes','recorded_class_sources') and relrowsecurity"),"2");
 console.log(`PASS clean replay: ${report.applied.length} migrations; both recording tables have RLS.`);
}catch(e){report.error=e.message;throw e;}finally{
 fs.mkdirSync(".local-qa",{recursive:true});fs.writeFileSync(".local-qa/recorded-migration-replay.json",JSON.stringify(report,null,2));
 // Drop only the exact disposable database created above on loopback.
 run(`drop database ${database}`,"postgres");
}
