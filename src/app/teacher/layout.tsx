import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthorIdentityProvider } from "@/components/admin/author-identity";
export default async function TeacherLayout({children}:{children:React.ReactNode}){const user=await currentUser();if(!user)redirect("/login");if(user.role!=="teacher")redirect(`/${user.role}`);return <AuthorIdentityProvider value={{id:user.id,role:user.role}}>{children}</AuthorIdentityProvider>}
