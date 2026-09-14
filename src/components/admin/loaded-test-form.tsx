"use client";
import type { CoreData,Test } from "@/lib/core-repository";
import { TestForm } from "./core-manager";
export function LoadedTestForm(props:{value:Test;data:CoreData;busy:boolean;save:(t:Test)=>Promise<void>}) {
 return <TestForm {...props} remoteQuestions/>;
}
