"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserRound, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { profilePhotoLimit, profilePhotoTypes, type StudentPersonalProfile } from "@/lib/student-profile";

export function ProfileEditor({initial,email}:{initial:StudentPersonalProfile;email:string}) {
  const router=useRouter(), saving=useRef(false), photoVersion=useRef(0);
  const [profile,setProfile]=useState(initial),[editing,setEditing]=useState(false),[name,setName]=useState(initial.full_name),[phone,setPhone]=useState(initial.phone || "");
  const [photo,setPhoto]=useState<File|null>(null),[preview,setPreview]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  const [checkingPhoto,setCheckingPhoto]=useState(false);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
  function edit(){setName(profile.full_name);setPhone(profile.phone || "");setPhoto(null);setPreview(null);setError("");setSuccess("");setEditing(true)}
  async function selectPhoto(file:File){
    const version=++photoVersion.current;setError("");
    if(!profilePhotoTypes.includes(file.type)||!file.size||file.size>profilePhotoLimit){setError("Choose a JPEG, PNG or WebP photo up to 2 MB.");return}
    setCheckingPhoto(true);
    try{const image=await createImageBitmap(file);const pixels=image.width*image.height;image.close();if(version!==photoVersion.current)return;if(!pixels||pixels>16_000_000)throw Error("Choose a photo up to 16 megapixels.");setPhoto(file);setPreview(URL.createObjectURL(file))}
    catch(reason){if(version===photoVersion.current)setError(reason instanceof Error&&reason.message.startsWith("Choose")?reason.message:"This photo could not be opened. Choose another JPEG, PNG or WebP image.")}
    finally{if(version===photoVersion.current)setCheckingPhoto(false)}
  }
  async function save(){
    if(saving.current)return;saving.current=true;setBusy(true);setError("");setSuccess("");
    try{
      const data=new FormData();data.set("full_name",name);data.set("phone",phone);if(photo)data.set("photo",photo);
      const response=await fetch("/api/account/profile",{method:"PATCH",body:data});const body=await response.json();
      if(!response.ok || !body.profile)throw Error(body.error || "Your profile could not be saved.");
      setProfile(body.profile);setPhoto(null);setPreview(null);setEditing(false);setSuccess("Profile saved.");router.refresh();
    }catch(error){setError(error instanceof Error?error.message:"Your profile could not be saved.")}
    finally{saving.current=false;setBusy(false)}
  }
  const photoUrl=preview || profile.photo_url;
  return <section className="card p-4 sm:p-6" aria-labelledby="profile-identity"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-4"><div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/10 text-brand">{photoUrl?<Image src={photoUrl} alt="Your profile photo" fill unoptimized sizes="80px" className="object-cover"/>:<UserRound size={32} aria-hidden="true"/>}</div><div className="min-w-0"><h2 id="profile-identity" className="break-words text-lg font-bold">{profile.full_name || "Your profile"}</h2><p className="mt-1 break-all text-sm text-muted">{email}</p></div></div>{!editing&&<Button variant="secondary" onClick={edit}><Pencil size={16}/>Edit profile</Button>}</div>
    {success&&<p role="status" className="mt-4 text-sm font-semibold text-green-800">{success}</p>}
    {editing?<form className="mt-6" onSubmit={event=>{event.preventDefault();void save()}}><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-semibold">Full name<input className="control" value={name} maxLength={120} required autoComplete="name" disabled={busy} onChange={event=>setName(event.target.value)}/></label><label className="block text-sm font-semibold">Phone <span className="font-normal text-muted">(optional)</span><input className="control" type="tel" maxLength={32} autoComplete="tel" disabled={busy} value={phone} onChange={event=>setPhone(event.target.value)}/></label></div><label className="mt-5 block text-sm font-semibold"><span className="inline-flex items-center gap-2"><Upload size={16}/>Change profile photo</span><input className="control mt-2 cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)void selectPhoto(file)}}/></label><p className="mt-2 text-xs text-muted">JPEG, PNG or WebP · up to 2 MB. Your email and program access are managed by ALS.</p>{error&&<p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="ghost" type="button" disabled={busy} onClick={()=>{photoVersion.current++;setCheckingPhoto(false);setEditing(false);setPhoto(null);setPreview(null);setError("")}}>Cancel</Button><Button type="submit" disabled={busy||checkingPhoto||!name.trim()}>{busy?"Saving…":"Save profile"}</Button></div></form>:<dl className="mt-5"><dt className="text-sm text-muted">Phone</dt><dd className="mt-1 font-semibold">{profile.phone || "Not provided"}</dd></dl>}
  </section>;
}
