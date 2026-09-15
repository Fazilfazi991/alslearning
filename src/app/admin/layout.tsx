import { AuthorIdentityProvider } from "@/components/admin/author-identity";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
export default async function AdminLayout({children}:{children:React.ReactNode}){const user=await currentUser();if(!user)redirect("/login");if(user.role!=="admin")redirect(`/${user.role}`);return <AuthorIdentityProvider value={{id:user.id,role:user.role}}>{children}</AuthorIdentityProvider>}
