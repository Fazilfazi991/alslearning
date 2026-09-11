import type { Metadata } from "next";
import { PortalLoginPage } from "@/components/shared/portal-login-page";
export const metadata: Metadata = { title: "Sign In" };
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}){const {error}=await searchParams;return <PortalLoginPage portal="student" loginError={error==="invalid-link"?"Sign-in could not be completed. Please sign in with your email and password.":undefined}/>}
