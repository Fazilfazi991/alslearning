import{NextResponse}from"next/server";import{createClient}from"@/lib/supabase/server";
export async function POST(request:Request){const db=await createClient();await db.auth.signOut();const form=await request.formData(),requested=form.get("redirectTo"),redirectTo=requested==="/admin"||requested==="/teacher"?requested:"/login";return NextResponse.redirect(new URL(redirectTo,request.url),303)}
