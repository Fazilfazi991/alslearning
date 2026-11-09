import Image from "next/image";
import { ArrowRight, BookOpen, CalendarCheck, Check, ClipboardCheck, GraduationCap, PlayCircle, Radio } from "lucide-react";
import { PublicHeader } from "@/components/shared/public-header";
import { ALSLogo } from "@/components/shared/als-logo";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { getPublicEnquiryPrograms } from "@/lib/enquiries-server";
import styles from "@/components/public/home.module.css";

export const dynamic = "force-dynamic";

function programImage(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized.startsWith("dhs")) return "/images/courses/basic-laboratory-safety.webp";
  if (normalized.startsWith("dme")) return "/images/courses/diagnostic-enzyme-markers.webp";
  if (normalized.replaceAll(" ", "").startsWith("mscmlt")) return "/images/courses/clinical-biochemistry.webp";
  if (normalized.startsWith("cre")) return "/images/courses/microbiology-essentials.webp";
  if (normalized.includes("micro")) return "/images/courses/microbiology-essentials.webp";
  if (normalized.includes("biochem")) return "/images/courses/clinical-biochemistry.webp";
  if (normalized.includes("path") || normalized.includes("hemato")) return "/images/courses/hematology-fundamentals.webp";
  return "/images/courses/medical-laboratory-technology.webp";
}

export default async function Home() {
  let programs: Awaited<ReturnType<typeof getPublicEnquiryPrograms>> = [];
  let unavailable = false;
  try { programs = await getPublicEnquiryPrograms(); } catch { unavailable = true; }

  return <div className={styles.home}>
    <PublicHeader />
    <main id="main-content">
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={`container-page ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <h1 id="home-title">Your next chapter in <span>laboratory science.</span></h1>
            <p>Build your understanding. Prepare with purpose. Bring your learning together with ALS programs, live classes, recordings and exam practice.</p>
            <div className={styles.heroActions}><a href="#enquire" className={styles.primaryLink}>Enquire Now <ArrowRight size={18} aria-hidden="true" /></a><a href="#courses" className={styles.secondaryLink}>Explore programs</a></div>
            <div className={styles.heroImage}><Image src="/images/courses/medical-laboratory-technology.webp" alt="Laboratory equipment used in medical laboratory science" fill sizes="(max-width: 767px) 100vw, 52vw" preload /><div className={styles.imageCaption}><GraduationCap size={21} aria-hidden="true" />Academy for Laboratory Science</div></div>
          </div>
          <EnquiryForm programs={programs} unavailable={unavailable} />
        </div>
      </section>
      <section className={styles.highlights} aria-label="Your ALS learning experience"><div className={`container-page ${styles.highlightGrid}`}>
        <div className={styles.highlight}><Radio size={24} aria-hidden="true" /><div><h2>Learn in live classes</h2><p>Join the scheduled sessions available to your batch.</p></div></div>
        <div className={styles.highlight}><PlayCircle size={24} aria-hidden="true" /><div><h2>Revisit recorded lessons</h2><p>Return to published recordings as you study.</p></div></div>
        <div className={styles.highlight}><ClipboardCheck size={24} aria-hidden="true" /><div><h2>Prepare through practice</h2><p>Work through assigned exams and review your results.</p></div></div>
      </div></section>
      <section className={`container-page ${styles.programs}`} id="courses" aria-labelledby="programs-title">
        <div className={styles.sectionHeading}><div><h2 id="programs-title">Find a program for your goals.</h2><p>Explore the programs currently available at ALS. Ask our admissions team about course coverage, batch availability and the right starting point for you.</p></div><a href="#enquire" className={styles.textLink}>Talk to admissions <ArrowRight size={16} aria-hidden="true" /></a></div>
        {programs.length > 0 ? <div className={styles.programGrid}>{programs.map(program => <article key={program.id} className={styles.programCard}>
          <div className={styles.courseImage}><Image src={programImage(program.name)} alt="" fill sizes="(max-width: 767px) 100vw, 33vw" /></div>
          <div className={styles.courseBody}><h3>{program.name}</h3><p>{program.description || "Discuss the syllabus, available batches and learning resources with ALS admissions."}</p><a href="#enquire" className={styles.textLink} aria-label={`Enquire about ${program.name}`}>Enquire about this program <ArrowRight size={16} aria-hidden="true" /></a></div>
        </article>)}</div> : <p className={styles.emptyPrograms}>{unavailable ? "We couldn’t load the program list right now. Please refresh this page in a moment." : "Program information will appear here when admissions are available. Please check back for updates."}</p>}
      </section>
      <section className={styles.why} id="about" aria-labelledby="why-title"><div className={`container-page ${styles.whyGrid}`}>
        <div><h2 id="why-title">A clearer path from learning to preparation.</h2><p className={styles.whyIntro}>Why choose ALS? Keep your laboratory science learning connected, from the subjects you study to the practice you complete.</p><a href="#enquire" className={styles.textLink}>Find your way forward <ArrowRight size={16} aria-hidden="true" /></a></div>
        <div className={styles.whyList}>
          <div className={styles.whyItem}><BookOpen size={22} aria-hidden="true" /><div><h3>Learning with a subject focus</h3><p>Follow the subjects and resources included in your program, with your assigned learning organised in one workspace.</p></div></div>
          <div className={styles.whyItem}><CalendarCheck size={22} aria-hidden="true" /><div><h3>A batch to learn with</h3><p>Access the classes scheduled for your enrollment and keep track of your upcoming learning sessions.</p></div></div>
          <div className={styles.whyItem}><Check size={22} aria-hidden="true" /><div><h3>Practice you can reflect on</h3><p>Complete published assessments, review available results and use them to guide your next study session.</p></div></div>
        </div>
      </div></section>
      <section className={`container-page ${styles.how}`} id="how-it-works" aria-labelledby="how-title"><h2 id="how-title">From your first question<br className="hidden sm:block" /> to your first class.</h2><div className={styles.steps}>
        <div><span className={styles.stepNumber} aria-hidden="true">1</span><h3>Tell us your goals</h3><p>Send an enquiry with the program you’re interested in and any questions you have.</p></div>
        <div><span className={styles.stepNumber} aria-hidden="true">2</span><h3>Plan with admissions</h3><p>Discuss program details and batch availability, then complete your admission with the ALS team.</p></div>
        <div><span className={styles.stepNumber} aria-hidden="true">3</span><h3>Start your learning</h3><p>Sign in to your student account to access your assigned courses, classes and assessments.</p></div>
      </div></section>
      <section className={styles.closing} id="contact" aria-labelledby="contact-title"><div className={`container-page ${styles.closingInner}`}><div><h2 id="contact-title">Let’s talk about what comes next.</h2><p>Have a question about studying with ALS? Start with an enquiry.</p></div><a href="#enquire" className={styles.primaryLink}>Contact admissions <ArrowRight size={18} aria-hidden="true" /></a></div></section>
    </main>
    <footer className={styles.footer}><div className="container-page"><div className={styles.footerInner}><ALSLogo /><nav aria-label="Footer navigation" className={styles.footerLinks}><a href="#courses">Programs</a><a href="#about">About ALS</a><a href="#enquire">Admissions enquiry</a><a href="/login">Student & staff sign in</a></nav></div><p className={styles.footerNote}>Academy for Laboratory Science · Learning resources and class access depend on your program and enrollment.</p></div></footer>
  </div>;
}
