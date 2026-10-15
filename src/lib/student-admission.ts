import { validAccountEmail, validAccountName, validAccountPassword, validAccountId, passwordHelp } from "./account-validation";
import { validProfilePhone } from "./student-profile";
export type StudentAdmission = {
  full_name:string; email:string; password:string; phone:string; admission_on:string;
  program_id:string; batch_id:string; access_starts_at:string; access_expires_at:string|null;
  unassigned:boolean; is_active:boolean; guardian_name:string; guardian_phone:string;
  guardian_relationship:string; address:string; internal_notes:string;
};
export function admissionErrors(value: Partial<StudentAdmission>) {
  const errors:Record<string,string>={};
  if(!validAccountName(value.full_name)) errors.full_name="Enter a name of 1–120 characters.";
  if(!validAccountEmail(value.email)) errors.email="Enter a valid email address.";
  if(!validAccountPassword(value.password)) errors.password=passwordHelp;
  if(!validProfilePhone(value.phone??"")) errors.phone="Enter a valid phone number (up to 32 characters).";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value.admission_on??"") || !Number.isFinite(Date.parse(value.admission_on!))) errors.admission_on="Choose the admission date.";
  if(typeof value.unassigned!=="boolean" || typeof value.is_active!=="boolean") errors.is_active="Choose an account and admission status.";
  if(!value.unassigned) {
    if(!validAccountId(value.program_id)) errors.program_id="Choose a Program.";
    if(!validAccountId(value.batch_id)) errors.batch_id="Choose a compatible Batch with a Batch Code.";
    if(!value.access_starts_at || !Number.isFinite(Date.parse(value.access_starts_at))) errors.access_starts_at="Choose an access start.";
    if(value.access_expires_at && (!Number.isFinite(Date.parse(value.access_expires_at)) || Date.parse(value.access_expires_at)<=Date.parse(value.access_starts_at??""))) errors.access_expires_at="Expiry must follow access start.";
  } else if(value.program_id || value.batch_id) errors.batch_id="Unassigned students cannot receive partial program access.";
  for(const [key,max] of Object.entries({guardian_name:120,guardian_relationship:80,address:1000,internal_notes:4000})) {
    const v=value[key as keyof StudentAdmission]; if(typeof v!=="string" || v.length>max) errors[key]=`Use up to ${max} characters.`;
  }
  if(!validProfilePhone(value.guardian_phone??"")) errors.guardian_phone="Enter a valid guardian phone number.";
  return errors;
}
