import{TeacherBackendPortal}from"@/components/teacher/teacher-backend-portal";
export default async function TeacherPage({params}:{params:Promise<{slug?:string[]}>}){const{slug}=await params;return <TeacherBackendPortal section={slug?.[0]||"dashboard"}/>}
