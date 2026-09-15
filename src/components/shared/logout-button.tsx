"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ className = "" }: { className?: string; redirectTo?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: browserError } = await createClient().auth.signOut({ scope: "local" });
      const response = await fetch("/auth/logout", { method: "POST", cache: "no-store" });
      if (browserError || !response.ok) throw new Error("Sign-out failed");
      // A fresh document also discards the previous account's router cache.
      window.location.replace("/login");
    } catch {
      setError("Could not sign out. Please try again.");
      setBusy(false);
    }
  }

  return <div className="relative"><button className={className} type="button" disabled={busy} onClick={() => void logout()}><LogOut size={18}/>{busy ? "Signing out…" : "Logout"}</button>{error && <span role="alert" className="absolute right-0 top-full z-50 min-w-52 rounded border border-red-200 bg-white p-2 text-xs text-red-800 shadow">{error}</span>}</div>;
}
