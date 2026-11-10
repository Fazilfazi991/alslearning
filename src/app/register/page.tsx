import { PublicHeader } from "@/components/shared/public-header";
import Link from "next/link";
import { PublicRegistration } from "@/components/registration/public-registration";
import { getPublicEnquiryPrograms } from "@/lib/enquiries-server";
import styles from "@/components/registration/public-registration.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration preview | ALS Academy", robots: { index: false, follow: false } };

export default async function Register({ searchParams }: { searchParams: Promise<{ program?: string | string[] }> }) {
  const params = await searchParams;
  let programs: Awaited<ReturnType<typeof getPublicEnquiryPrograms>> = [];
  let unavailable = false;
  try { programs = await getPublicEnquiryPrograms(); } catch { unavailable = true; }
  const preselected = typeof params.program === "string" && programs.some(program => program.id === params.program) ? params.program : "";
  return <div className={styles.page}>
    <PublicHeader />
    <main id="main-content" className={styles.layout}>
      <div className={styles.intro}>
        <Link href="/" className={styles.backLink}>← Back to ALS Academy</Link>
        <h1>Let’s begin your <span>learning journey.</span></h1>
        <p>Explore the four-step registration experience and see how applicants will share their details with ALS admissions.</p>
        <div className={styles.notice}><strong>Design preview only</strong><p>Please use sample details. Applications cannot be submitted or saved yet. Contact ALS admissions through the homepage for current enquiries.</p></div>
      </div>
      <PublicRegistration programs={programs} unavailable={unavailable} initialProgram={preselected} />
    </main>
  </div>;
}
