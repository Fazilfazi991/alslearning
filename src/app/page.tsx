import Image from "next/image";
import { ArrowRight, BookOpen, CalendarCheck, Check, ClipboardCheck, GraduationCap, PlayCircle, Radio, Plus } from "lucide-react";
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
            <div className={styles.heroActions}><a href="#courses" className={styles.primaryLink}>Explore programs <ArrowRight size={18} aria-hidden="true" /></a><a href="#enquire" className={styles.secondaryLink}>Enquire now</a></div><div className={styles.heroTrust}><span><Check size={15} aria-hidden="true" /> Guided learning</span><span><Check size={15} aria-hidden="true" /> Practice-led preparation</span></div>
            <div className={styles.heroImage}><Image src="/images/als-editorial-student.webp" alt="Illustration of a laboratory science student working with a microscope" fill sizes="(max-width: 767px) 100vw, 52vw" preload /><div className={styles.imageCaption}><GraduationCap size={21} aria-hidden="true" />A closer look at learning <span> / </span> Illustrative image</div></div>
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
      </div><div className={`container-page ${styles.labEditorial}`}><div className={styles.labImage}><Image src="/images/als-editorial-lab.webp" alt="Illustrative laboratory workbench with a microscope and study materials" loading="eager" fill sizes="(max-width: 767px) 100vw, 70vw" /></div><p>Curiosity is where<br /><strong>progress begins.</strong><span>Learning, with purpose.</span></p></div></section>
      <section className={`container-page ${styles.how}`} id="how-it-works" aria-labelledby="how-title"><h2 id="how-title">From your first question<br className="hidden sm:block" /> to your first class.</h2><div className={styles.steps}>
        <div><span className={styles.stepNumber} aria-hidden="true">1</span><h3>Tell us your goals</h3><p>Send an enquiry with the program you’re interested in and any questions you have.</p></div>
        <div><span className={styles.stepNumber} aria-hidden="true">2</span><h3>Plan with admissions</h3><p>Discuss program details and batch availability, then complete your admission with the ALS team.</p></div>
        <div><span className={styles.stepNumber} aria-hidden="true">3</span><h3>Start your learning</h3><p>Sign in to your student account to access your assigned courses, classes and assessments.</p></div>
      </div></section>
      <section className={styles.stories} id="student-stories" aria-labelledby="stories-title"><div className={`container-page ${styles.storiesGrid}`}><div><h2 id="stories-title">The journey, in our students’ words.</h2><p>Discover the experiences and perspectives of the people learning with ALS.</p><a href="#enquire" className={styles.textLink}>Start your own journey <ArrowRight size={16} aria-hidden="true" /></a></div><div className={styles.storyPlaceholder}><span className={styles.storyIcon}><BookOpen size={30} aria-hidden="true" /></span><div><h3>Student stories are coming soon</h3><p>We’ll share student experiences here as they become available.</p></div></div></div></section>
      <section className={styles.faq} id="faq" aria-labelledby="faq-title"><div className={`container-page ${styles.faqGrid}`}><div><h2 id="faq-title">Questions before you begin?</h2><p>Every learning journey starts somewhere. Our admissions team can help you find your next step.</p><a href="#enquire" className={styles.textLink}>Ask admissions <ArrowRight size={16} aria-hidden="true" /></a></div><div className={styles.faqList}>
        {[
          ["Who can join ALS programs?", "Eligibility can vary by program. Share your interests and background with admissions to discuss the right option for you."],
          ["How do admissions work?", "Send an enquiry and the admissions team can discuss program details, available batches and the next steps with you."],
          ["Are live classes and recordings available?", "Students can access the live classes scheduled for their batch and published recordings available to their enrollment. Availability depends on the program."],
          ["How are batches assigned?", "The ALS team will discuss available batches and enrollment details during the admissions process."],
          ["How do I access classes and materials?", "After enrollment, sign in to your student account to find your assigned courses, classes and learning resources."]
        ].map(([question, answer]) => <details key={question} className={styles.faqItem}><summary>{question}<Plus size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}
      </div></div></section>
      <section className={styles.closing} id="contact" aria-labelledby="contact-title"><div className={`container-page ${styles.closingInner}`}><div><h2 id="contact-title">Your next chapter starts with a conversation.</h2><p>Have a question about studying with ALS? Start with an enquiry.</p></div><a href="#enquire" className={styles.primaryLink}>Contact admissions <ArrowRight size={18} aria-hidden="true" /></a></div></section>
    </main>
    <footer className={styles.footer}><div className="container-page"><div className={styles.footerInner}><ALSLogo /><nav aria-label="Footer navigation" className={styles.footerLinks}><a href="#courses">Programs</a><a href="#about">Why ALS</a><a href="#how-it-works">How it works</a><a href="#student-stories">Student stories</a><a href="#faq">FAQs</a><a href="#enquire">Admissions enquiry</a><a href="/login">Student & staff sign in</a></nav></div><p className={styles.footerNote}>Academy for Laboratory Science · Learning resources and class access depend on your program and enrollment.</p></div></footer>
  </div>;
}


