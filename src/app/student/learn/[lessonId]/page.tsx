import{notFound}from"next/navigation";import{CoreLearningPlayer}from"@/components/learning/core-learning-player";import{getLearningContent}from"@/lib/student-data";
export default async function LessonPage({params}:{params:Promise<{lessonId:string}>}){const{lessonId}=await params,data=await getLearningContent(lessonId);if(!data)notFound();return <CoreLearningPlayer data={data}/>}
