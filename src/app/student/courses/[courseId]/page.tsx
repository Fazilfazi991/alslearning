import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, FileText, PlayCircle } from "lucide-react";
import { getCourseDetail } from "@/lib/student-data";
export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params,
    data = await getCourseDetail(courseId);
  if (!data) notFound();
  const subjects = data.program.program_subjects.flatMap((x) => x.subjects);
  return (
    <div className="mx-auto max-w-[1220px]">
      <header className="rounded-2xl bg-deep-blue p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase text-pink-200">
          Enrolled program
        </p>
        <h1 className="mt-2 text-3xl font-bold">{data.program.name}</h1>
        <p className="mt-3 max-w-3xl text-blue-100">
          {data.program.description ||
            "Program learning resources will appear here as they are published."}
        </p>
        <p className="mt-4 text-sm">
          Access:{" "}
          {data.enrollment.access_expires_at
            ? `until ${new Date(data.enrollment.access_expires_at).toLocaleDateString()}`
            : "No expiry"}
        </p>
      </header>
      <section className="mt-6">
        <h2 className="text-xl font-bold">Subjects</h2>
        {subjects.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {subjects.map((s) => (
              <span
                key={s.id}
                className="rounded-full border bg-white px-3 py-2 text-sm font-semibold"
              >
                {s.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No subjects are assigned yet.
          </p>
        )}
      </section>
      <section className="mt-7">
        <h2 className="text-xl font-bold">Learning content</h2>
        {data.content.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {data.content.map((item) => (
              <article key={item.id} className="card p-5">
                <div className="flex gap-3">
                  {item.kind === "video" ? (
                    <PlayCircle className="text-brand" />
                  ) : (
                    <FileText className="text-brand" />
                  )}
                  <div>
                    <p className="text-xs font-bold uppercase text-muted">
                      {item.kind}
                    </p>
                    <h3 className="mt-1 font-bold">{item.title}</h3>
                  </div>
                </div>
                {item.description && (
                  <p className="mt-3 text-sm text-muted">{item.description}</p>
                )}
                <Link
                  className="mt-4 inline-flex font-bold text-brand"
                  href={`/student/learn/${item.slug}`}
                >
                  {item.kind === "video" ? "Open lesson" : "Open resource"}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="card mt-4 grid min-h-48 place-items-center text-center">
            <div>
              <BookOpen className="mx-auto text-muted" />
              <p className="mt-3 font-bold">
                No learning content has been published yet.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
