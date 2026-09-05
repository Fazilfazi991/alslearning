import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service)
  throw new Error(
    "Supabase URL, publishable key and temporary service key are required.",
  );
const root = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  suffix = crypto.randomUUID(),
  password = `Qa-${crypto.randomUUID()}!aA1`;
const roles = ["admin", "teacher", "student", "student"],
  labels = ["admin", "teacher", "student", "outsider"],
  users = {},
  results = {};
let fixture = {};
const assert = (name, condition, detail = "") => {
  results[name] = { pass: Boolean(condition), detail };
  if (!condition) throw new Error(`${name}: ${detail}`);
};
async function userClient(label) {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: `als-qa-${label}-${suffix}@example.invalid`,
    password,
  });
  if (error) throw error;
  return client;
}
try {
  for (let i = 0; i < labels.length; i++) {
    const { data, error } = await root.auth.admin.createUser({
      email: `als-qa-${labels[i]}-${suffix}@example.invalid`,
      password,
      email_confirm: true,
      app_metadata: { role: roles[i] },
      user_metadata: { full_name: `QA ${labels[i]}` },
    });
    if (error) throw error;
    users[labels[i]] = data.user.id;
  }
  const { data: roleRows, error: roleError } = await root
    .from("profiles")
    .select("id,role")
    .in("id", Object.values(users));
  assert(
    "trusted_app_metadata_syncs_profile_roles",
    !roleError &&
      labels.every((label, index) =>
        roleRows.some(
          (row) => row.id === users[label] && row.role === roles[index],
        ),
      ),
    roleError?.message,
  );
  const [admin, teacher, student, outsider] = await Promise.all(
    labels.map(userClient),
  );
  const { data: exam } = await root
    .from("entrance_exams")
    .select("id")
    .eq("slug", "cre")
    .single();
  const { data: subjects } = await root
    .from("subjects")
    .select("id,slug")
    .in("slug", ["biochemistry", "pathology"]);
  const assignedSubject = subjects.find((x) => x.slug === "biochemistry").id,
    otherSubject = subjects.find((x) => x.slug === "pathology").id;
  let response = await admin
    .from("programs")
    .insert({
      name: "QA Program",
      slug: `qa-program-${suffix}`,
      exam_id: exam.id,
      status: "active",
    })
    .select("id")
    .single();
  assert("admin_can_create_program", !response.error, response.error?.message);
  fixture.program = response.data.id;
  response = await admin
    .from("batches")
    .insert({
      name: "QA Batch",
      slug: `qa-batch-${suffix}`,
      program_id: fixture.program,
      exam_id: exam.id,
      status: "active",
    })
    .select("id")
    .single();
  assert("admin_can_create_batch", !response.error, response.error?.message);
  fixture.batch = response.data.id;
  await root.from("faculty_assignments").insert({
    faculty_id: users.teacher,
    program_id: fixture.program,
    subject_id: assignedSubject,
    can_manage_content: true,
    can_manage_questions: true,
    can_manage_tests: true,
  });
  await root.from("enrollments").insert({
    student_id: users.student,
    program_id: fixture.program,
    batch_id: fixture.batch,
    status: "active",
    access_starts_at: new Date(Date.now() - 60000).toISOString(),
  });
  response = await teacher
    .from("learning_content")
    .insert({
      kind: "video",
      slug: `qa-video-${suffix}`,
      title: "QA Video",
      program_id: fixture.program,
      subject_id: assignedSubject,
      external_url: "https://example.invalid/video",
      status: "active",
    })
    .select("id")
    .single();
  assert(
    "assigned_teacher_can_create_content",
    !response.error,
    response.error?.message,
  );
  fixture.content = response.data.id;
  const addQuestion = async (subject, prompt) => {
    const { data, error } = await root
      .from("questions")
      .insert({
        exam_id: exam.id,
        program_id: fixture.program,
        subject_id: subject,
        type: "single_mcq",
        prompt,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw error;
    const correctOption=crypto.randomUUID(),wrongOption=crypto.randomUUID();
    await root.from("question_options").insert([
      { id:correctOption,question_id: data.id, content: "A" },
      { id:wrongOption,question_id: data.id, content: "B" },
    ]);
    await root.from("question_answer_keys").insert({question_id:data.id,option_id:correctOption});
    return data.id;
  };
  fixture.assignedQuestion = await addQuestion(
    assignedSubject,
    "Assigned question",
  );
  fixture.otherQuestion = await addQuestion(
    otherSubject,
    "Unassigned question",
  );
  let check = await student
    .from("learning_content")
    .select("id")
    .eq("id", fixture.content);
  assert(
    "enrolled_student_reads_content",
    check.data?.length === 1,
    check.error?.message,
  );
  check = await outsider
    .from("learning_content")
    .select("id")
    .eq("id", fixture.content);
  assert(
    "outsider_cannot_read_content",
    check.data?.length === 0,
    check.error?.message,
  );
  check = await student.from("profiles").select("id").eq("id", users.outsider);
  assert(
    "student_profile_isolation",
    check.data?.length === 0,
    check.error?.message,
  );
  check = await teacher
    .from("questions")
    .select("id")
    .in("id", [fixture.assignedQuestion, fixture.otherQuestion]);
  assert(
    "teacher_reads_only_assigned_questions",
    check.data?.length === 1 && check.data[0].id === fixture.assignedQuestion,
    check.error?.message,
  );
  check=await student.from("question_answer_keys").select("option_id").eq("question_id",fixture.assignedQuestion);assert("student_cannot_read_answer_keys",check.data?.length===0,check.error?.message);
  check = await student
    .from("questions")
    .update({ prompt: "forbidden" })
    .eq("id", fixture.assignedQuestion)
    .select("id");
  assert(
    "student_cannot_modify_questions",
    Boolean(check.error) || check.data?.length === 0,
    check.error?.message || `${check.data?.length} rows changed`,
  );
  check = await student.from("video_progress").insert({
    content_id: fixture.content,
    student_id: users.student,
    position_seconds: 12,
  });
  assert("student_saves_own_progress", !check.error, check.error?.message);
  check = await student.from("video_progress").insert({
    content_id: fixture.content,
    student_id: users.outsider,
    position_seconds: 12,
  });
  assert(
    "student_cannot_write_other_progress",
    Boolean(check.error),
    check.error?.message || "unexpected success",
  );
  check = await student
    .from("enrollments")
    .update({ status: "suspended" })
    .eq("student_id", users.student)
    .select("id");
  assert(
    "student_cannot_modify_enrollment",
    Boolean(check.error) || check.data?.length === 0,
    check.error?.message || `${check.data?.length} rows changed`,
  );
  check = await admin
    .from("programs")
    .update({ description: "QA verified" })
    .eq("id", fixture.program)
    .select("id");
  assert(
    "admin_can_update_academic_content",
    !check.error && check.data?.length === 1,
    check.error?.message || `${check.data?.length} rows changed`,
  );
  const path = `qa/${suffix}.txt`;
  check = await student.storage
    .from("learning-content")
    .upload(path, new Blob(["denied"]));
  assert(
    "student_cannot_upload_unapproved_storage",
    Boolean(check.error),
    check.error?.message || "unexpected success",
  );
  check = await admin.storage
    .from("learning-content")
    .upload(path, new Blob(["verified"]));
  assert(
    "admin_can_upload_private_storage",
    !check.error,
    check.error?.message,
  );
  await root.storage.from("learning-content").remove([path]);

  response = await teacher
    .from("tests")
    .insert({
      slug: `qa-test-${suffix}`,
      title: "QA Test",
      type: "mock",
      program_id: fixture.program,
      subject_id: assignedSubject,
      question_count: 1,
      duration_minutes: 10,
      status: "active",
    })
    .select("id")
    .single();
  assert(
    "assigned_teacher_can_create_test",
    !response.error,
    response.error?.message,
  );
  fixture.test = response.data.id;
  await root
    .from("test_questions")
    .insert({ test_id: fixture.test, question_id: fixture.assignedQuestion });
  response = await student
    .from("test_attempts")
    .insert({
      test_id: fixture.test,
      student_id: users.student,
      question_order: [fixture.assignedQuestion],
    })
    .select("id")
    .single();
  assert(
    "student_starts_eligible_attempt",
    !response.error,
    response.error?.message,
  );
  fixture.attempt = response.data.id;
  const { data: correctKey } = await root.from("question_answer_keys").select("option_id").eq("question_id", fixture.assignedQuestion).single();
  check = await student
    .from("attempt_answers")
    .insert({
      attempt_id: fixture.attempt,
      question_id: fixture.assignedQuestion,
      selected_option_ids: [correctKey.option_id],
    });
  assert("student_answer_persists", !check.error, check.error?.message);
  const scored = await student.rpc("submit_test_attempt", {
    target_attempt: fixture.attempt,
  });
  assert(
    "server_scoring_persists_result",
    !scored.error && Number(scored.data) === 1,
    scored.error?.message || String(scored.data),
  );

  response = await root
    .from("video_checkpoints")
    .insert({
      video_id: fixture.content,
      question_id: fixture.assignedQuestion,
      trigger_seconds: 5,
      mandatory: true,
    })
    .select("id")
    .single();
  fixture.checkpoint = response.data.id;
  const checkpoint = await student.rpc("submit_checkpoint_response", {
    target_checkpoint: fixture.checkpoint,
    option_ids: [correctKey.option_id],
  });
  assert(
    "checkpoint_response_persists",
    !checkpoint.error && checkpoint.data === true,
    checkpoint.error?.message,
  );

  response = await teacher
    .from("live_sessions")
    .insert({
      title: "QA Live",
      program_id: fixture.program,
      batch_id: fixture.batch,
      subject_id: assignedSubject,
      faculty_id: users.teacher,
      status: "scheduled",
      provider: "cloudflare-realtime",
    })
    .select("id")
    .single();
  assert(
    "assigned_teacher_schedules_live_session",
    !response.error,
    response.error?.message,
  );
  fixture.live = response.data.id;
  check = await student.rpc("set_live_presence", {
    target_session: fixture.live,
    joined: true,
  });
  assert("eligible_student_presence_join", !check.error, check.error?.message);
  check = await student
    .from("live_messages")
    .insert({
      session_id: fixture.live,
      sender_id: users.student,
      body: "QA message",
    });
  assert("eligible_student_chat_persists", !check.error, check.error?.message);
  check = await teacher
    .from("live_participants")
    .update({ audio_publish_allowed: true })
    .match({ session_id: fixture.live, user_id: users.student })
    .select("user_id");
  assert(
    "teacher_grants_student_audio",
    !check.error && check.data?.length === 1,
    check.error?.message,
  );
  check = await student
    .from("live_participants")
    .update({ presenter: true })
    .match({ session_id: fixture.live, user_id: users.student })
    .select("user_id");
  assert(
    "student_cannot_self_promote",
    Boolean(check.error) || check.data?.length === 0,
    check.error?.message || `${check.data?.length} rows changed`,
  );
  check = await student.rpc("set_live_presence", {
    target_session: fixture.live,
    joined: false,
  });
  assert("attendance_leave_persists", !check.error, check.error?.message);
  process.stdout.write(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  if (fixture.live)
    await root.from("live_sessions").delete().eq("id", fixture.live);
  if (fixture.checkpoint)
    await root.from("video_checkpoints").delete().eq("id", fixture.checkpoint);
  if (fixture.attempt)
    await root.from("test_attempts").delete().eq("id", fixture.attempt);
  if (fixture.test) await root.from("tests").delete().eq("id", fixture.test);
  if (fixture.assignedQuestion || fixture.otherQuestion)
    await root
      .from("questions")
      .delete()
      .in(
        "id",
        [fixture.assignedQuestion, fixture.otherQuestion].filter(Boolean),
      );
  if (fixture.content)
    await root
      .from("video_progress")
      .delete()
      .eq("content_id", fixture.content);
  if (fixture.content)
    await root.from("learning_content").delete().eq("id", fixture.content);
  if (fixture.program)
    await root
      .from("faculty_assignments")
      .delete()
      .eq("program_id", fixture.program);
  if (fixture.program)
    await root.from("enrollments").delete().eq("program_id", fixture.program);
  if (fixture.batch)
    await root.from("batches").delete().eq("id", fixture.batch);
  if (fixture.program)
    await root.from("programs").delete().eq("id", fixture.program);
  for (const id of Object.values(users)) await root.auth.admin.deleteUser(id);
}
