export const enquiryStatuses = ["new", "contacted", "interested", "follow_up", "converted", "closed"] as const;
export type EnquiryStatus = typeof enquiryStatuses[number];
export type EnquiryProgram = { id: string; name: string; description?: string | null };
export type Enquiry = {
  id: string; full_name: string; phone: string; email: string | null; program_id: string;
  message: string | null; status: EnquiryStatus; assigned_to: string | null;
  student_id: string | null; created_at: string; updated_at: string;
  programs: { id: string; name: string } | null;
};
