import { createClient } from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!anon||!service)throw new Error("Supabase URL, publishable key and temporary service key are required.");
const root=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),suffix=crypto.randomUUID(),password=`Qa-${crypto.randomUUID()}!aA1`;
const roles=["admin","teacher","student","student"],labels=["admin","teacher","student","outsider"],users={},results={};let fixture={};
const assert=(name,condition,detail="")=>{results[name]={pass:Boolean(condition),detail};if(!condition)throw new Error(`${name}: ${detail}`)};
async function userClient(label){const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const{error}=await client.auth.signInWithPassword({email:`als-qa-${label}-${suffix}@example.invalid`,password});if(error)throw error;return client}
try{
  for(let i=0;i<labels.length;i++){const{data,error}=await root.auth.admin.createUser({email:`als-qa-${labels[i]}-${suffix}@example.invalid`,password,email_confirm:true,app_metadata:{role:roles[i]},user_metadata:{full_name:`QA ${labels[i]}`}});if(error)throw error;users[labels[i]]=data.user.id}
  const [admin,teacher,student,outsider]=await Promise.all(labels.map(userClient));
  const{data:exam}=await root.from("entrance_exams").select("id").eq("slug","cre").single();const{data:subjects}=await root.from("subjects").select("id,slug").in("slug",["biochemistry","pathology"]);const assignedSubject=subjects.find(x=>x.slug==="biochemistry").id,otherSubject=subjects.find(x=>x.slug==="pathology").id;
  let response=await admin.from("programs").insert({name:"QA Program",slug:`qa-program-${suffix}`,exam_id:exam.id,status:"active"}).select("id").single();assert("admin_can_create_program",!response.error,response.error?.message);fixture.program=response.data.id;
  response=await admin.from("batches").insert({name:"QA Batch",slug:`qa-batch-${suffix}`,program_id:fixture.program,exam_id:exam.id,status:"active"}).select("id").single();assert("admin_can_create_batch",!response.error,response.error?.message);fixture.batch=response.data.id;
  await root.from("faculty_assignments").insert({faculty_id:users.teacher,program_id:fixture.program,subject_id:assignedSubject,can_manage_content:true,can_manage_questions:true,can_manage_tests:true});
  await root.from("enrollments").insert({student_id:users.student,program_id:fixture.program,batch_id:fixture.batch,status:"active",access_starts_at:new Date(Date.now()-60000).toISOString()});
  response=await teacher.from("learning_content").insert({kind:"video",slug:`qa-video-${suffix}`,title:"QA Video",program_id:fixture.program,subject_id:assignedSubject,external_url:"https://example.invalid/video",status:"active"}).select("id").single();assert("assigned_teacher_can_create_content",!response.error,response.error?.message);fixture.content=response.data.id;
  const addQuestion=async(subject,prompt)=>{const{data,error}=await root.from("questions").insert({exam_id:exam.id,program_id:fixture.program,subject_id:subject,type:"single_mcq",prompt,status:"active"}).select("id").single();if(error)throw error;await root.from("question_options").insert([{question_id:data.id,content:"A",is_correct:true},{question_id:data.id,content:"B",is_correct:false}]);return data.id};fixture.assignedQuestion=await addQuestion(assignedSubject,"Assigned question");fixture.otherQuestion=await addQuestion(otherSubject,"Unassigned question");
  let check=await student.from("learning_content").select("id").eq("id",fixture.content);assert("enrolled_student_reads_content",check.data?.length===1,check.error?.message);check=await outsider.from("learning_content").select("id").eq("id",fixture.content);assert("outsider_cannot_read_content",check.data?.length===0,check.error?.message);
  check=await student.from("profiles").select("id").eq("id",users.outsider);assert("student_profile_isolation",check.data?.length===0,check.error?.message);
  check=await teacher.from("questions").select("id").in("id",[fixture.assignedQuestion,fixture.otherQuestion]);assert("teacher_reads_only_assigned_questions",check.data?.length===1&&check.data[0].id===fixture.assignedQuestion,check.error?.message);
  check=await student.from("questions").update({prompt:"forbidden"}).eq("id",fixture.assignedQuestion).select("id");assert("student_cannot_modify_questions",Boolean(check.error)||check.data?.length===0,check.error?.message||`${check.data?.length} rows changed`);
  check=await student.from("video_progress").insert({content_id:fixture.content,student_id:users.student,position_seconds:12});assert("student_saves_own_progress",!check.error,check.error?.message);check=await student.from("video_progress").insert({content_id:fixture.content,student_id:users.outsider,position_seconds:12});assert("student_cannot_write_other_progress",Boolean(check.error),check.error?.message||"unexpected success");
  check=await student.from("enrollments").update({status:"suspended"}).eq("student_id",users.student).select("id");assert("student_cannot_modify_enrollment",Boolean(check.error)||check.data?.length===0,check.error?.message||`${check.data?.length} rows changed`);
  check=await admin.from("programs").update({description:"QA verified"}).eq("id",fixture.program).select("id");assert("admin_can_update_academic_content",!check.error&&check.data?.length===1,check.error?.message||`${check.data?.length} rows changed`);
  const path=`qa/${suffix}.txt`;check=await student.storage.from("learning-content").upload(path,new Blob(["denied"]));assert("student_cannot_upload_unapproved_storage",Boolean(check.error),check.error?.message||"unexpected success");check=await admin.storage.from("learning-content").upload(path,new Blob(["verified"]));assert("admin_can_upload_private_storage",!check.error,check.error?.message);await root.storage.from("learning-content").remove([path]);
  process.stdout.write(JSON.stringify({ok:true,results},null,2));
}finally{
  if(fixture.assignedQuestion||fixture.otherQuestion)await root.from("questions").delete().in("id",[fixture.assignedQuestion,fixture.otherQuestion].filter(Boolean));
  if(fixture.content)await root.from("video_progress").delete().eq("content_id",fixture.content);
  if(fixture.content)await root.from("learning_content").delete().eq("id",fixture.content);
  if(fixture.program)await root.from("faculty_assignments").delete().eq("program_id",fixture.program);
  if(fixture.program)await root.from("enrollments").delete().eq("program_id",fixture.program);
  if(fixture.batch)await root.from("batches").delete().eq("id",fixture.batch);
  if(fixture.program)await root.from("programs").delete().eq("id",fixture.program);
  for(const id of Object.values(users))await root.auth.admin.deleteUser(id);
}
