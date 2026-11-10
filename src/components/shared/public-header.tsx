"use client";

import { Menu, X, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ALSLogo } from "./als-logo";

const links = [{ label: "Programs", href: "/#courses" }, { label: "Why ALS", href: "/#about" }, { label: "How it works", href: "/#how-it-works" }];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (!open) return;
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  const home = path === "/";
  return <header className="sticky top-0 z-50 border-b border-line bg-white pt-[env(safe-area-inset-top)]">
    {home && <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-3">Skip to content</a>}
    <div className="container-page flex h-16 items-center justify-between gap-3 lg:h-20"><div className="public-header-logo"><ALSLogo /></div><nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">{links.map(link => <Link key={link.href} href={link.href} className="py-3 text-sm font-semibold text-muted hover:text-brand">{link.label}</Link>)}</nav><div className="hidden items-center gap-5 sm:flex"><Link href="/login" className="py-3 text-sm font-semibold text-muted hover:text-brand">Sign in</Link><Link href="/#enquire" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-dark">Enquire Now <ArrowRight size={16} aria-hidden="true" /></Link></div><button ref={trigger} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line lg:hidden" onClick={() => setOpen(!open)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="public-mobile-navigation">{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button></div>
    {open && <nav id="public-mobile-navigation" aria-label="Mobile main navigation" className="container-page grid gap-1 border-t border-line py-4 lg:hidden">{links.map(link => <Link key={link.href} href={home ? link.href.slice(1) : link.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-surface">{link.label}</Link>)}<Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-surface">Student & staff sign in</Link><Link href={home ? "#enquire" : "/#enquire"} onClick={() => setOpen(false)} className="mt-2 rounded-lg bg-brand px-4 py-3 text-center text-sm font-bold text-white hover:bg-brand-dark">Enquire Now</Link></nav>}
  </header>;
}
