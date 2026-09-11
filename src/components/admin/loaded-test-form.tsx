"use client";
import { useEffect,useState } from "react";
import type { CoreData,Test } from "@/lib/core-repository";
import { loadTestQuestionIndex } from "@/lib/test-repository";
import { TestForm } from "./core-manager";
export function LoadedTestForm(props:{value:Test;data:CoreData;busy:boolean;save:(t:Test)=>Promise<void>}) {
 const [state,setState]=useState<{status:"loading"|"ready"|"error";data?:CoreData;error?:string}>({status:"loading"});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;loadTestQuestionIndex(props.data.role).then(questions=>{if(live)setState({status:"ready",data:{...props.data,questions}});}).catch(e=>{if(live)setState({status:"error",error:e.message});});return()=>{live=false;};},[props.data,retry]);
 if(state.status!=="ready")return <div role="status" className="space-y-4"><p>{state.status==="loading"?"Loading current question availability…":state.error}</p>{state.status==="error"&&<button type="button" onClick={()=>{setState({status:"loading"});setRetry(n=>n+1);}}>Retry availability</button>}<p className="text-sm text-muted">Save is unavailable until the current question scope is verified. Existing question selections are preserved.</p></div>;
 return <TestForm {...props} data={state.data!}/>;
}
