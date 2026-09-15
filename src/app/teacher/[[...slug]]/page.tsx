import{TeacherBackendPortal}from"@/components/teacher/teacher-backend-portal";
import { notFound } from "next/navigation";
export default async function TeacherPage({params}:{params:Promise<{slug?:string[]}>}){const{slug}=await params;if((slug?.length||0)>1||slug?.[0]&&!(["courses","students","live-classes","assessments","question-bank","content"].includes(slug[0])))notFound();return <TeacherBackendPortal section={slug?.[0]||"dashboard"}/>}
