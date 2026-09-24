import { NextResponse } from "next/server";

/** Removed: this endpoint previously proxied arbitrary SFU payloads and IDs. */
export async function POST() {
  return NextResponse.json(
    { error: "Use the class-scoped media endpoint" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
