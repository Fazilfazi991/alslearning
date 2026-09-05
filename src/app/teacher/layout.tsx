import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/shared/logout-button";
import { PortalLoginPage } from "@/components/shared/portal-login-page";
export default async function TeacherLayout({children}:{children:React.ReactNode}){const user=await currentUser();if(!user)return <PortalLoginPage portal="teacher"/>;if(!["teacher","admin"].includes(user.role))redirect(`/${user.role}`);return <><LogoutButton redirectTo="/teacher" className="fixed right-20 top-3 z-50 hidden min-h-10 items-center gap-2 rounded border bg-white px-3 text-sm font-bold sm:flex"/>{children}</>}
