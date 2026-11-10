import { PublicHeader } from "@/components/shared/public-header";
import Link from "next/link";
import { PublicRegistration } from "@/components/registration/public-registration";
import { getPublicEnquiryPrograms } from "@/lib/enquiries-server";
import styles from "@/components/registration/public-registration.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Student registration | ALS Academy" };

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
        <p>Tell us a little about yourself and the program you’re interested in. Our admissions team will review your application and guide you through the next steps.</p>
        <div className={styles.notice}><strong>Before you begin</strong><p>Have your contact and educational details ready. Submitting an application does not grant access to classes; the ALS team will contact you after review.</p></div>
      </div>
      <PublicRegistration programs={programs} unavailable={unavailable} initialProgram={preselected} />
    </main>
  </div>;
}
