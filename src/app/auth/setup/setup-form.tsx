"use client";
import { useState, type FormEvent } from "react";
import { passwordHelp, validAccountPassword } from "@/lib/account-validation";
export function SetupForm() {
  const [password,setPassword]=useState(""), [confirm,setConfirm]=useState(""), [error,setError]=useState(""), [pending,setPending]=useState(false), [done,setDone]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(pending)return;
    if(!validAccountPassword(password)) {setError(passwordHelp);return;}
    if(password!==confirm) {setError("Passwords do not match.");return;}
    setPending(true);setError("");
    try {const response=await fetch("/api/auth/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});const body=await response.json(); if(!response.ok){setError(body.error || "Please try again.");return;}setPassword("");setConfirm("");setDone(true);}catch{setError("Could not connect. Please try again.");}finally{setPending(false);}
  }
  if(done)return <p role="status">Your password is set. <a href="/login">Sign in to start learning</a>.</p>;
  return <form onSubmit={submit} style={{display:"grid",gap:12,marginTop:24}}><label htmlFor="password">New password</label><input id="password" type="password" autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)} style={{border:"1px solid #aaa",padding:12,borderRadius:6}}/><small>{passwordHelp}</small><label htmlFor="confirm">Confirm password</label><input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)} style={{border:"1px solid #aaa",padding:12,borderRadius:6}}/>{error&&<p role="alert">{error}</p>}<button type="submit" disabled={pending} style={{background:"#912160",color:"white",padding:14,borderRadius:6}}>{pending?"Setting up…":"Set password"}</button></form>;
}
