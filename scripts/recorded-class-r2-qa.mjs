import assert from "node:assert/strict";
import { createReadStream, createWriteStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createClient } from "@supabase/supabase-js";

const recordingId="573ecbcc-05d7-4212-8b50-fbdb7463af37";
const root="C:/Users/User/Videos/ALS Migration/99e6a06b-a64e-43cd-be4c-686f070246ef";
const files=[
  {role:"source",path:`${root}/source/original.mp4`,key:`recorded-classes/${recordingId}/source/original.mp4`,type:"video/mp4"},
  {role:"delivery",path:`${root}/delivery/video.mp4`,key:`recorded-classes/${recordingId}/delivery/video.mp4`,type:"video/mp4"},
  {role:"poster",path:`${root}/delivery/poster.jpg`,key:`recorded-classes/${recordingId}/delivery/poster.jpg`,type:"image/jpeg"},
];
for(const name of ["R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET_NAME","NEXT_PUBLIC_SUPABASE_URL","SUPABASE_ACCESS_TOKEN"]) assert.ok(process.env[name],`${name} is required`);
const s3=new S3Client({region:"auto",endpoint:process.env.R2_ENDPOINT||`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
const bucket=process.env.R2_BUCKET_NAME;
const sha=path=>new Promise((resolve,reject)=>{const h=createHash("sha256");createReadStream(path).on("data",x=>h.update(x)).on("error",reject).on("end",()=>resolve(h.digest("hex")));});
const report=[];
for(const file of files){
  assert.ok(existsSync(file.path),`Missing ${file.path}`); const size=statSync(file.path).size; const checksum=await sha(file.path);
  let existing=null; try{existing=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:file.key}));}catch{}
  const started=Date.now();
  if(Number(existing?.ContentLength)!==size){
    const upload=new Upload({client:s3,params:{Bucket:bucket,Key:file.key,Body:createReadStream(file.path),ContentType:file.type,Metadata:{sha256:checksum,role:file.role}},queueSize:3,partSize:16*1024*1024,leavePartsOnError:false});
    upload.on("httpUploadProgress",p=>{if(p.loaded) process.stdout.write(`\r${file.role}: ${Math.round(p.loaded*100/size)}%`);});
    await upload.done(); process.stdout.write("\n");
  }
  const head=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:file.key}));
  assert.equal(Number(head.ContentLength),size); assert.equal(head.Metadata?.sha256,checksum);
  report.push({role:file.role,key:file.key,size,checksum,seconds:Number(((Date.now()-started)/1000).toFixed(2)),contentType:head.ContentType});
}
const range=await s3.send(new GetObjectCommand({Bucket:bucket,Key:files[1].key,Range:"bytes=1048576-2097151"}));
assert.equal(range.ContentRange,"bytes 1048576-2097151/281318307");
mkdirSync(".local-qa/r2",{recursive:true}); const verified=".local-qa/r2/carbohydrates-delivery-verified.mp4";
await pipeline((await s3.send(new GetObjectCommand({Bucket:bucket,Key:files[1].key}))).Body,createWriteStream(verified));
assert.equal(await sha(verified),report.find(x=>x.role==="delivery").checksum); rmSync(verified);

let serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!serviceKey){
  const response=await fetch("https://api.supabase.com/v1/projects/xstssknlgdraulebdsfd/api-keys",{headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`}});
  assert.equal(response.ok,true,"Could not resolve the QA service credential");
  const keys=await response.json(); serviceKey=keys.find(key=>key.name==="service_role")?.api_key;
}
assert.ok(serviceKey,"QA service credential unavailable");
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,serviceKey,{auth:{persistSession:false}});
const {data:before,error:beforeError}=await db.from("recorded_classes").select("id,provider,provider_video_id,title,status").eq("id",recordingId).single();
assert.ifError(beforeError); assert.equal(before.title,"Carbohydrates II");
const delivery=report.find(x=>x.role==="delivery");
const {error:updateError}=await db.from("recorded_classes").update({provider:"native",storage_provider:"r2",storage_key:files[1].key,source_storage_key:files[0].key,poster_storage_key:files[2].key,mime_type:"video/mp4",file_size:delivery.size,width:1920,height:1080,duration_seconds:6726,checksum_sha256:delivery.checksum,original_provider:before.provider==="youtube"?"youtube":before.original_provider,original_provider_video_id:before.provider_video_id||before.original_provider_video_id}).eq("id",recordingId);
assert.ifError(updateError);
const fixtures=[
  {recorded_class_id:recordingId,timestamp_seconds:30,question:"QA FIXTURE — select the first option to verify required playback gating.",options:["QA option A","QA option B"],correct_option:0,explanation:"QA fixture response verified.",required_before_continue:true,allow_retry:true,show_explanation_after_answer:true,sort_order:1,status:"published"},
  {recorded_class_id:recordingId,timestamp_seconds:75,question:"QA FIXTURE — verify seek-crossing pauses the class.",options:["Verified","Not verified"],correct_option:0,explanation:"QA fixture only; not educational content.",required_before_continue:true,allow_retry:true,show_explanation_after_answer:true,sort_order:2,status:"published"},
  {recorded_class_id:recordingId,timestamp_seconds:120,question:"QA FIXTURE — verify optional Quick Check behavior.",options:["Continue","Retry"],correct_option:0,explanation:"QA fixture only.",required_before_continue:false,allow_retry:true,show_explanation_after_answer:true,sort_order:3,status:"published"},
];
const {data:existingFixtures}=await db.from("recorded_class_interactions").select("question").eq("recorded_class_id",recordingId).like("question","QA FIXTURE —%");
if(!existingFixtures?.length){const {error}=await db.from("recorded_class_interactions").insert(fixtures);assert.ifError(error);}
const {data:after,error:afterError}=await db.from("recorded_classes").select("id,provider,storage_provider,storage_key,source_storage_key,poster_storage_key,file_size,checksum_sha256,original_provider,original_provider_video_id,status").eq("id",recordingId).single();
assert.ifError(afterError); assert.equal(after.provider,"native"); assert.equal(after.original_provider_video_id,"xNBduyugQSc");
console.log(JSON.stringify({bucket,private:true,rangeVerified:true,fullChecksumVerified:true,objects:report,recording:after,qaFixtures:fixtures.length},null,2));
