import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PortalLoginPage } from "@/components/shared/portal-login-page";
export default async function AdminLayout({children}:{children:React.ReactNode}){const user=await currentUser();if(!user)return <PortalLoginPage portal="admin"/>;if(user.role!=="admin")redirect(`/${user.role}`);return <>{children}</>}
