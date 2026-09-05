import type { Metadata } from "next";
import { PortalLoginPage } from "@/components/shared/portal-login-page";
export const metadata: Metadata = { title: "Student Sign In" };
export default function LoginPage(){return <PortalLoginPage portal="student"/>}
