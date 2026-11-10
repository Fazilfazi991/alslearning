import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-session";

const statuses = ["pending", "needs_information", "approved", "rejected"];
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const session = await adminSession();
    if (session.response) return session.response;
    const params = new URL(request.url).searchParams;
    const status = params.get("status") || "";
    if (status && !statuses.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400, headers });
    const rawPage = Number(params.get("page") || "1");
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1;
    const q = (params.get("q") || "").trim().slice(0, 120).replace(/[^\p{L}\p{N}@+ .-]/gu, "");
    let query = session.db!.from("student_registrations").select("id,full_name,email,phone,program_id,status,created_at,student_id,programs(id,name)", { count: "exact" });
    if (status) query = query.eq("status", status);
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    const result = await query.order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
    if (result.error) throw Error();
    return NextResponse.json({ registrations: result.data, count: result.count ?? 0, page, page_size: 20 }, { headers });
  } catch { return NextResponse.json({ error: "Applications could not be loaded. Please retry." }, { status: 503, headers }); }
}
