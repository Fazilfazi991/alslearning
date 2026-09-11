import { notFound } from "next/navigation";
import { CourseLearningHub } from "@/components/student/course-learning-hub";
import { getStudentCourse } from "@/lib/student-courses-server";
export default async function Page({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ subject?: string }> }) {
  const [{ courseId }, { subject }] = await Promise.all([params, searchParams]);
  const data = await getStudentCourse(courseId, subject);
  if (!data) notFound();
  return <CourseLearningHub data={data} basePath={`/student/courses/${courseId}`}/>;
}
