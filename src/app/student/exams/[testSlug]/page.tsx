import{notFound}from"next/navigation";import{BackendTestEngine}from"@/components/student/backend-test-engine";import{getTestForStudent}from"@/lib/student-data";
export default async function TestPage({params}:{params:Promise<{testSlug:string}>}){const{testSlug}=await params,data=await getTestForStudent(testSlug);if(!data)notFound();return <BackendTestEngine data={data}/>}
