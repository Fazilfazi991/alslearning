import { requireRole } from "@/lib/auth";
import { LogoutButton } from "@/components/shared/logout-button";
export default async function TeacherLayout({children}:{children:React.ReactNode}){await requireRole(["teacher","admin"]);return <><LogoutButton className="fixed right-20 top-3 z-50 hidden min-h-10 items-center gap-2 rounded border bg-white px-3 text-sm font-bold sm:flex"/>{children}</>}
