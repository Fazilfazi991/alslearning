import{notFound}from"next/navigation";import{BackendLearningPlayer}from"@/components/learning/backend-learning-player";import{getLearningContent}from"@/lib/student-data";
export default async function LessonPage({params}:{params:Promise<{lessonId:string}>}){const{lessonId}=await params,data=await getLearningContent(lessonId);if(!data)notFound();return <BackendLearningPlayer data={data}/>}
