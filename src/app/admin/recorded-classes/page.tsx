import { RecordingReviewQueue } from "@/components/admin/recording-review-queue";
import { AdminShell } from "@/components/admin/admin-shell";
import { RecordedClassesManager } from "@/components/admin/recorded-classes-manager";
export default function Page() { return <AdminShell><RecordingReviewQueue/><RecordedClassesManager/></AdminShell>; }
