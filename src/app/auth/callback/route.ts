import { NextResponse } from "next/server";

// Old emailed links no longer establish sessions. Password login is the only
// application sign-in flow; invitations/reset UX can be added explicitly later.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url));
}
