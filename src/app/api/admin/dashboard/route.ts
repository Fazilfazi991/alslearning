import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";
import type { DashboardData } from "@/types/dashboard";

export async function GET() {
  try {
    const session = await adminSession();
    if (session.response) return session.response;
    const db = session.db!;
    const count = async (table: string, filters: Record<string, string | boolean> = {}) => {
      let query = db.from(table).select("id", { count: "exact", head: true });
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      const result = await query;
      if (result.error || result.count === null) throw Error("Counts unavailable");
      return result.count;
    };
    // Panels fail independently so a missing admissions migration never hides LMS data.
    const [academic, admissions, recentAdmissions, recentEnquiries, upcomingClasses] = await Promise.allSettled([
      Promise.all([
        count("profiles", { role: "student" }), count("profiles", { role: "student", is_active: true }),
        count("batches", { status: "active" }), count("faculty_members"), count("programs", { status: "active" }),
        count("questions", { status: "active" }), count("tests", { status: "active" }), count("lms_class_catalog", { status: "published" }),
      ]).then(([students, activeStudents, activeBatches, faculty, activePrograms, questions, tests, recordings]) => ({ students, activeStudents, activeBatches, faculty, activePrograms, questions, tests, recordings })),
      Promise.all([
        count("admission_enquiries"), count("admission_enquiries", { status: "new" }), count("admission_enquiries", { status: "converted" }),
        db.from("enquiry_follow_ups").select("id,admission_enquiries!inner(status)", { count: "exact", head: true }).is("completed_at", null).not("admission_enquiries.status", "in", "(converted,closed)"),
      ]).then(([total, fresh, converted, followups]) => {
        if (followups.error || followups.count === null) throw Error("Follow-ups unavailable");
        return { total, new: fresh, converted, pending: followups.count };
      }),
      db.from("profiles").select("id,full_name,student_code,admission_on").eq("role", "student").not("admission_on", "is", null).order("admission_on", { ascending: false }).order("id").limit(5),
      db.from("admission_enquiries").select("id,full_name,status,created_at").order("created_at", { ascending: false }).order("id").limit(5),
      db.from("live_sessions").select("id,title,starts_at,status").eq("status", "scheduled").gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
    ]);
    const data: DashboardData = {
      academic: academic.status === "fulfilled" ? academic.value : null,
      admissions: admissions.status === "fulfilled" ? admissions.value : null,
      recentAdmissions: recentAdmissions.status === "fulfilled" && !recentAdmissions.value.error ? recentAdmissions.value.data : null,
      recentEnquiries: recentEnquiries.status === "fulfilled" && !recentEnquiries.value.error ? recentEnquiries.value.data : null,
      upcomingClasses: upcomingClasses.status === "fulfilled" && !upcomingClasses.value.error ? upcomingClasses.value.data : null,
    };
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Dashboard could not be loaded. Please retry." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
