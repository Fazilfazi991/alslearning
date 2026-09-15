import { notFound } from "next/navigation";

// No persisted certificate issuance exists yet. Never invent a verified document.
export default function CertificatePage() {
  notFound();
}
