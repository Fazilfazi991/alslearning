import assert from "node:assert/strict";
import fs from "node:fs";
import {randomBytes} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {createServerClient} from "@supabase/ssr";
import {QA,management} from "./helper-grants-lib.mjs";
import {importClientRecordings} from "./recorded-classes-client-content.mjs";
assert.equal(QA,"xstssknlgdraulebdsfd");
const url=`https://${QA}.supabase.co`;
const keys=await management(QA,"api-keys");
const anon=keys.find(k=>k.name==="anon").api_key;
const service=createClient(url,keys.find(k=>k.name==="service_role").api_key,{auth:{persistSession:false}});
const file=".local-qa/recorded-classes-auth.json";
const auth=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):{url,anon,password:randomBytes(24).toString("base64url"),users:{}};
assert.equal(auth.url,url);
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
for(const role of ["admin","student","teacher"]){
 if(!auth.users[role]){const email=`recorded-classes-qa-${role}@example.invalid`;const r=ok(await service.auth.admin.createUser({email,password:auth.password,email_confirm:true,app_metadata:{role},user_metadata:{full_name:`Recorded Classes QA ${role}`}}));auth.users[role]={id:r.user.id,email};fs.writeFileSync(file,JSON.stringify(auth,null,2));}
}
const clients={};
for(const [role,user] of Object.entries(auth.users)){
 const cookies=[];
 const db=createServerClient(url,anon,{cookies:{getAll:()=>cookies,setAll:values=>{for(const value of values){const i=cookies.findIndex(c=>c.name===value.name);if(i>=0)cookies[i]=value;else cookies.push(value);}}}});
 ok(await db.auth.signInWithPassword({email:user.email,password:auth.password}));clients[role]=db;
 fs.writeFileSync(`.local-qa/recorded-${role}-state.json`,JSON.stringify({cookies:cookies.map(c=>({name:c.name,value:c.value,domain:"localhost",path:"/",httpOnly:false,secure:false,sameSite:"Lax",expires:-1})),origins:[]}));
}
const {admin,student,teacher}=clients;
if(process.argv.includes("--cleanup-browser")){
 const fixtures=ok(await admin.from("recorded_classes").select("id").eq("created_by",auth.users.admin.id).eq("title","QA ONLY — Browser recording"));
 for(const row of fixtures)ok(await service.from("recorded_classes").delete().eq("id",row.id));
 console.log("Removed only this task's disposable browser recordings.");process.exit(0);
}
const imported=await importClientRecordings(admin);
assert.deepEqual(await importClientRecordings(admin),imported);
fs.writeFileSync(".local-qa/recorded-classes-import.json",JSON.stringify(imported,null,2));
if(process.argv.includes("--setup")){console.log(JSON.stringify({imported:imported.map(r=>({id:r.id,title:r.title})),count:imported.length}));process.exit(0);}
// Reuse only this task's dedicated program; reset its QA enrollment before denial tests.
if(auth.program){
 assert.equal(ok(await admin.from("programs").select("name").eq("id",auth.program).single()).name,"QA ONLY — Recorded classes");
 ok(await service.from("enrollments").delete().eq("program_id",auth.program).eq("student_id",auth.users.student.id));
}
const checks=[];
function pass(label,result){assert.ok(result,label);checks.push(label);}
async function save(value){return admin.rpc("save_recorded_class",{value});}
const base={subject_id:imported[0].subject_id,chapter_id:imported[0].chapter_id,title:"QA ONLY — Recording lifecycle",status:"draft",sort_order:0};
const draft=ok(await save(base));
try {
 pass("Draft without link allowed",!!draft);
 pass("Published without link rejected",!!(await save({...base,id:draft,status:"published"})).error);
 pass("Cross-subject Topic rejected",!!(await save({...base,id:draft,chapter_id:imported[2].chapter_id})).error);
 pass("Malformed ID rejected by database",!!(await save({...base,id:draft,provider_video_id:"bad"})).error);
 pass("Teacher authoring denied",!!(await teacher.rpc("save_recorded_class",{value:base})).error);
 pass("Student authoring denied",!!(await student.rpc("save_recorded_class",{value:base})).error);
 pass("Unenrolled Student denied",ok(await student.from("recorded_classes").select("id")).length===0);
 const published=ok(await save({...base,id:draft,provider_video_id:imported[0].videoId,status:"published",subtopic:"QA optional group",original_source_url:"https://studio.youtube.com/video/xNBduyugQSc/edit"}));
 pass("Admin edit and publish",published===draft);
 const program=auth.program ? {id:auth.program} : ok(await admin.from("programs").insert({name:"QA ONLY — Recorded classes",slug:`recorded-classes-${Date.now()}`,status:"active"}).select("id").single());
 auth.program=program.id;fs.writeFileSync(file,JSON.stringify(auth,null,2));
 ok(await admin.rpc("core_program_subjects",{target_program:program.id,subject_ids:[imported[0].subject_id]}));
 const enrollment=ok(await admin.from("enrollments").insert({student_id:auth.users.student.id,program_id:program.id,status:"active",access_starts_at:new Date(Date.now()-60000).toISOString(),access_expires_at:new Date(Date.now()+86400000*7).toISOString()}).select("id").single());
 pass("Active enrolled Student can read published recording",ok(await student.from("recorded_classes").select("*").eq("id",draft)).length===1);
 const row=ok(await student.from("recorded_classes").select("*").eq("id",draft).single());
 pass("Student API contains no source URL",!JSON.stringify(row).includes("studio.youtube") && !("original_source_url" in row));
 pass("Student source RPC denied",ok(await student.rpc("recorded_class_source",{target:draft}))===null);
 pass("Admin source traceability",ok(await admin.rpc("recorded_class_source",{target:draft})).includes("studio.youtube"));
 pass("Student direct update denied",ok(await student.from("recorded_classes").update({title:"Unauthorized"}).eq("id",draft).select("id")).length===0);
 pass("Teacher direct update denied",ok(await teacher.from("recorded_classes").update({title:"Unauthorized"}).eq("id",draft).select("id")).length===0);
 const other=ok(await save({...base,subject_id:imported[2].subject_id,chapter_id:imported[2].chapter_id,title:"QA ONLY — Cross subject",provider_video_id:imported[2].videoId,status:"published"}));
 pass("Cross-subject published read denied",ok(await student.from("recorded_classes").select("id").eq("id",other)).length===0);
 ok(await service.from("recorded_classes").delete().eq("id",other));
 ok(await admin.from("enrollments").update({access_expires_at:new Date(Date.now()-1000).toISOString()}).eq("id",enrollment.id));
 pass("Expired enrollment denied",ok(await student.from("recorded_classes").select("id").eq("id",draft)).length===0);
 ok(await admin.from("enrollments").update({access_starts_at:new Date(Date.now()+86400000).toISOString(),access_expires_at:new Date(Date.now()+86400000*7).toISOString()}).eq("id",enrollment.id));
 pass("Future enrollment denied",ok(await student.from("recorded_classes").select("id").eq("id",draft)).length===0);
 ok(await admin.from("enrollments").update({access_starts_at:new Date(Date.now()-60000).toISOString()}).eq("id",enrollment.id));
 ok(await admin.from("recorded_classes").update({status:"archived"}).eq("id",draft));
 pass("Archived recording denied",ok(await student.from("recorded_classes").select("id").eq("id",draft)).length===0);
 ok(await save({...base,id:draft,provider_video_id:imported[0].videoId}));
 pass("Draft with link denied",ok(await student.from("recorded_classes").select("id").eq("id",draft)).length===0);
 pass("Exactly five imported records",ok(await admin.from("recorded_classes").select("id").in("import_key",imported.map(r=>r.key))).length===5);
 pass("Hemostasis hidden",ok(await student.from("recorded_classes").select("id").eq("id",imported[1].id)).length===0);
 // The dedicated QA Student now has all three subjects for browser acceptance.
 ok(await admin.rpc("core_program_subjects",{target_program:program.id,subject_ids:[...new Set(imported.map(r=>r.subject_id))]}));
 fs.writeFileSync(".local-qa/recorded-classes-db-qa.json",JSON.stringify({checks,passed:checks.length},null,2));
 console.log(JSON.stringify({passed:checks.length,checks}));
} finally {ok(await service.from("recorded_classes").delete().eq("id",draft));}
for(const db of Object.values(clients))await db.auth.signOut({scope:"local"});
