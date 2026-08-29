import Image from "next/image";
import { Copy, Download, Printer, Share2, ShieldCheck } from "lucide-react";
import { CertificateActions } from "@/components/student/certificate-actions";
import { PageHeader } from "@/components/student/page-header";

export default function Page(){return <div className="mx-auto max-w-5xl">
  <PageHeader title="Certificate" description="A verified record of your completed ALS learning."/>
  <div className="overflow-x-auto pb-3"><section className="relative mx-auto min-w-[760px] overflow-hidden border-[10px] border-double border-[#c5a059] bg-white p-12 text-center shadow-[0_18px_50px_rgba(42,67,127,.12)]"><div className="absolute inset-5 border border-[#c5a059]/35"/><div className="relative">
    <Image src="/brand/als-logo-official.png" alt="ALS official logo" width={92} height={92} className="mx-auto"/>
    <p className="mt-3 text-sm font-bold uppercase tracking-[.16em] text-deep-blue">Academy for Laboratory Science</p>
    <h1 className="mt-8 text-3xl font-extrabold tracking-[.18em] text-brand">CERTIFICATE OF COMPLETION</h1>
    <p className="mt-8 text-sm text-muted">This is to certify that</p><p className="mt-4 text-3xl font-extrabold tracking-wide">AMEEN MOHAMMED</p>
    <p className="mt-6 text-sm text-muted">has successfully completed</p><p className="mt-4 text-2xl font-extrabold text-deep-blue">CLINICAL BIOCHEMISTRY</p><p className="mt-5 text-sm">on 28 August 2026</p>
    <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-8 border-t border-line pt-8 text-xs"><div><div className="mx-auto mb-2 w-28 border-t border-ink"/><b>Dr. Sarah Ahmed</b><p className="text-muted">Instructor</p></div><div><ShieldCheck className="mx-auto text-[#c5a059]" size={36}/><b>Verified</b><p className="text-muted">ALS-CB-2026-001284</p></div><div><div className="mx-auto mb-2 w-28 border-t border-ink"/><b>Authorized Signatory</b><p className="text-muted">ALS Academy</p></div></div>
  </div></section></div>
  <div className="mt-6 flex flex-wrap justify-center gap-3"><CertificateActions label="Download PDF" icon={<Download size={17}/>}/><CertificateActions label="Print" icon={<Printer size={17}/>}/><CertificateActions label="Share" icon={<Share2 size={17}/>}/><CertificateActions label="Copy Verification Link" icon={<Copy size={17}/>}/></div>
</div>}
