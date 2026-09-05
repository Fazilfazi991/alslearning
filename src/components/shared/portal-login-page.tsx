import { BookOpen, CalendarDays, PlayCircle } from "lucide-react";
import { ALSLogo } from "@/components/shared/als-logo";
import { LoginForm } from "@/components/shared/login-form";
import type { AppRole } from "@/lib/auth";

const copy = {
  student: ["Student access", "Your learning continues here.", "Sign in securely to access the learning content assigned to your active enrollment."],
  teacher: ["Teacher access", "Your teaching workspace.", "Sign in with your assigned teacher account to manage your classes and academic resources."],
  admin: ["Administration access", "Manage the ALS platform.", "Sign in with an authorized administrator account to manage academic operations."],
} satisfies Record<AppRole, readonly [string, string, string]>;

export function PortalLoginPage({ portal }: { portal: AppRole }) {
  const [eyebrow, title, description] = copy[portal];
  const features = [[BookOpen, "Assigned programs and study materials"], [PlayCircle, "Recorded lessons and saved progress"], [CalendarDays, "Upcoming live classes and schedules"]] as const;
  return <main className="min-h-screen bg-white lg:grid lg:grid-cols-2"><section className="relative hidden overflow-hidden bg-deep-blue p-12 text-white lg:flex lg:flex-col"><div className="absolute -right-28 -top-28 h-96 w-96 rounded-full border border-white/10"/><div className="absolute -bottom-28 left-20 h-80 w-80 rounded-full bg-brand/25 blur-3xl"/><div className="relative"><ALSLogo href="/"/></div><div className="relative my-auto max-w-xl"><p className="text-xs font-bold uppercase tracking-[.14em] text-pink-200">Welcome back to ALS</p><h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-[-.035em]">{title}</h1><p className="mt-4 leading-7 text-blue-100">{description}</p><div className="mt-10 space-y-3 rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur">{features.map(([Icon,label])=><div key={label} className="flex items-center gap-3 rounded-xl bg-white/10 p-4"><Icon className="text-pink-200" size={19}/><p className="font-semibold">{label}</p></div>)}</div></div><p className="relative text-xs text-blue-200">Academy for Laboratory Science</p></section><section className="flex min-h-screen items-center justify-center p-6 sm:p-10"><div className="w-full max-w-md"><div className="mb-10 lg:hidden"><ALSLogo/></div><p className="eyebrow">{eyebrow}</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight">Welcome Back</h1><p className="mt-2 text-sm text-muted">Sign in to continue to the {portal} portal.</p><LoginForm expectedRole={portal}/></div></section></main>;
}
