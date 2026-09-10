import{notFound}from"next/navigation";import{CoreTestEngine}from"@/components/student/core-test-engine";import{getTestForStudent}from"@/lib/student-data";
export default async function TestPage({params}:{params:Promise<{testSlug:string}>}){const{testSlug}=await params,data=await getTestForStudent(testSlug);if(!data)notFound();return <CoreTestEngine data={data}/>}
