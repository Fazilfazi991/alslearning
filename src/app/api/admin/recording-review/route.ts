import {NextResponse} from "next/server";
import {adminSession} from "@/lib/admin-session";
import {isSameOriginRequest} from "@/lib/request-origin";
import {validAccountId} from "@/lib/account-validation";
import {r2RecordingStorage} from "@/lib/live-class/recording-storage";
import {recordingObjectBelongs} from "@/lib/live-class/recording-object";
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;const page=Math.max(0,Math.min(10000,Number.parseInt(params.get("page")||"0",10)||0));const view=params.get("view")||"pending";
  const s=await adminSession();if(s.response)return s.response;
  const id=params.get("id");if(id&&!validAccountId(id))return NextResponse.json({error:"Invalid recording."},{status:400});
  let query=s.db!.from("class_recordings").select("id,session_id,status,duration_seconds,total_bytes,client_validated_at,verified_at,published_at,rejected_at,rejection_reason,error_message,review_title,review_description,live_sessions!inner(id,title,status,provider,starts_at,recording_enabled,programs(name),subjects(name),batches(name),profiles!live_sessions_faculty_id_fkey(full_name)),live_recording_segments(id,status,total_bytes,object_key)",{count:"exact"}).eq("live_sessions.recording_enabled",true).order("created_at",{ascending:false});
  if(view==="published")query=query.eq("status","published");else if(view==="pending")query=query.neq("status","published");
  if(id)query=query.eq("id",id);
  const result=await query.range(page*20,page*20+19);
  if(result.error)return NextResponse.json({error:"Recording review could not be loaded."},{status:503});
  const recordings=await Promise.all((result.data??[]).map(async row=> {
    let asset_state="processing";
    if(["ready","validating","published"].includes(row.status) && row.live_recording_segments.length && row.live_recording_segments.every(g=>["ready","validating"].includes(g.status)&&g.total_bytes>0)) {
      try {
        if(row.live_recording_segments.some(g=>!recordingObjectBelongs(g.object_key,row.session_id,row.id,g.id)))throw Error("Invalid asset scope");
        const assets=await Promise.all(row.live_recording_segments.map(g=>r2RecordingStorage.verify(g.object_key)));
        asset_state=assets.every((a,i)=>a.byteLength===row.live_recording_segments[i].total_bytes)?"ready":"missing";
      }catch{asset_state="unavailable";}
    }
    return {...row,asset_state,live_recording_segments:row.live_recording_segments.map(({id,status,total_bytes})=>({id,status,total_bytes}))};
  }));
  return NextResponse.json({recordings,total:result.count??0},{headers:{"Cache-Control":"private, no-store"}});
}
export async function PATCH(request:Request){
  if(!isSameOriginRequest(request))return NextResponse.json({error:"Invalid request."},{status:403});
  const s=await adminSession();if(s.response)return s.response;
  let b:Record<string,unknown>;try{b=await request.json();}catch{return NextResponse.json({error:"Invalid form."},{status:400});}
  if(!b || Object.keys(b).some(k=>!["id","session_id","title","description"].includes(k)) || !validAccountId(b.id) || !validAccountId(b.session_id) || typeof b.title!=="string" || !b.title.trim() || b.title.length>250 || typeof b.description!=="string" || b.description.length>10000)return NextResponse.json({error:"Enter a title (1–250 characters) and description (up to 10,000)."},{status:400});
  const r=await s.db!.from("class_recordings").update({review_title:b.title.trim(),review_description:b.description.trim()||null}).eq("id",b.id).eq("session_id",b.session_id).select("id").single();
  if(r.error || !r.data)return NextResponse.json({error:"Recording metadata was not saved."},{status:422});
  return NextResponse.json({success:true});
}
