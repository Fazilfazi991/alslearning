import { ArrowUpRight, Award, BookOpen, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProgressBar } from "@/components/ui/progress";
import type { Course } from "@/types";

export function CourseCard({ course, publicView = false }: { course: Course; publicView?: boolean }) {
  const href = publicView ? "/login" : course.slug === "clinical-biochemistry" ? `/student/courses/${course.slug}` : "/student/courses";
  return <article className="card group flex h-full flex-col overflow-hidden p-5 transition hover:-translate-y-1 hover:shadow-[0_16px_38px_rgba(42,67,127,.12)]">
    <div className="relative mb-5 h-28 overflow-hidden rounded-xl bg-surface">
      <Image src={course.image} alt={`${course.title} scientific course artwork`} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-t from-deep-blue/35 via-transparent to-transparent" />
      <span className="absolute bottom-3 left-3 rounded-full border border-white/60 bg-white/90 px-3 py-1 text-[11px] font-bold text-brand shadow-sm backdrop-blur">{course.category}</span>
    </div>
    <h3 className="text-lg font-bold tracking-tight">{course.title}</h3>
    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{course.description}</p>
    <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted"><span className="flex items-center gap-1"><BookOpen size={14} />{course.lessons} lessons</span><span className="flex items-center gap-1"><Clock size={14} />{course.duration}</span></div>
    {!publicView && <div className="mt-5"><ProgressBar value={course.progress} /></div>}
    {course.certificate && <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#8c681f]"><Award size={15} />Certificate available</span>}
    <div className="mt-auto flex items-center justify-between border-t border-line pt-4 mt-5"><span className="text-xs text-muted">{course.instructor}</span><Link href={href} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-brand transition group-hover:bg-brand group-hover:text-white" aria-label={`Open ${course.title}`}><ArrowUpRight size={18} /></Link></div>
  </article>;
}
