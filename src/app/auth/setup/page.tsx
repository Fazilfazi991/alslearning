import { SetupForm } from "./setup-form";
export const metadata = { title: "Set up your student account" };
export default function SetupPage() { return <main style={{maxWidth: 480, margin: "8vh auto", padding: "24px"}}><p>ALS ACADEMY</p><h1>Set up your student account</h1><p>Choose a secure password to complete your invitation.</p><SetupForm /></main>; }
