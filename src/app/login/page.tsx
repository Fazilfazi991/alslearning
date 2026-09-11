import type { Metadata } from "next";
import { PortalLoginPage } from "@/components/shared/portal-login-page";
export const metadata: Metadata = { title: "Student Sign In" };
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}){const {error}=await searchParams;return <PortalLoginPage portal="student" loginError={error==="invalid-link"?"This sign-in link could not be verified. It may have expired, already been used, or opened in a different browser. Request a new link here and open it in this same browser.":undefined}/>}
