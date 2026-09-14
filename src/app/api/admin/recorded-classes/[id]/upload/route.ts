import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { abortRecordedClassUpload, beginRecordedClassUpload, completeRecordedClassUpload, signRecordedClassUploadPart } from "@/lib/recorded-classes-r2";

type Body = { action?: "begin" | "sign" | "complete" | "abort"; fileName?: string; contentType?: string; fileSize?: number; objectKey?: string; uploadId?: string; partNumber?: number; parts?: { partNumber: number; etag: string }[] };
const invalid = () => NextResponse.json({ error: "Invalid upload request" }, { status: 400 });

export async function POST(request: Request, context: RouteContext<"/api/admin/recorded-classes/[id]/upload">) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const { id } = await context.params;
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await db.from("profiles").select("role,is_active").eq("id", auth.user.id).single();
  if (profile?.role !== "admin" || !profile.is_active) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { data: recording } = await db.from("recorded_classes").select("id").eq("id", id).single();
  if (!recording) return NextResponse.json({ error: "Recording unavailable" }, { status: 404 });
  let body: Body;
  try { body = await request.json() as Body; } catch { return invalid(); }
  try {
    if (body.action === "begin") {
      if (!body.fileName || body.contentType !== "video/mp4" || !Number.isSafeInteger(body.fileSize) || body.fileSize! <= 0) return invalid();
      return NextResponse.json(await beginRecordedClassUpload(id, body.fileName, body.contentType));
    }
    if (!body.objectKey?.startsWith(`recorded-classes/${id}/`) || !body.uploadId) return invalid();
    if (body.action === "sign" && Number.isInteger(body.partNumber)) return NextResponse.json({ url: await signRecordedClassUploadPart(body.objectKey, body.uploadId, body.partNumber!) });
    if (body.action === "complete" && Array.isArray(body.parts) && body.parts.length) {
      const metadata = await completeRecordedClassUpload(body.objectKey, body.uploadId, body.parts);
      return NextResponse.json({ objectKey: body.objectKey, fileSize: metadata.ContentLength ?? null, mimeType: metadata.ContentType ?? "video/mp4", etag: metadata.ETag ?? null });
    }
    if (body.action === "abort") { await abortRecordedClassUpload(body.objectKey, body.uploadId); return NextResponse.json({ aborted: true }); }
    return invalid();
  } catch { return NextResponse.json({ error: "R2 upload operation failed" }, { status: 502 }); }
}
