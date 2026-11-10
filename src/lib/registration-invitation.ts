import "server-only";
import { randomUUID } from "node:crypto";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { makeRegistrationRecoveryGrant } from "@/lib/registration-setup-grant";

/** Only call after the approved registration has been independently verified. */
export async function sendRegistrationInvitation(registrationId: string, studentId: string, email: string): Promise<"sent" | "failed"> {
  // Enable only after validating the invite template and identity immutability
  // guards in the target environment. Never fall back to a request Host header.
  if (process.env.REGISTRATION_INVITATION_ENABLED !== "true" || (process.env.REGISTRATION_SETUP_SECRET?.length ?? 0) < 32) return "failed";
  let origin: URL;
  try { origin = new URL(process.env.REGISTRATION_SITE_URL ?? ""); if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) return "failed"; }
  catch { return "failed"; }
  const root = createAuthAdminClient(), attemptId = randomUUID();
  try {
    const ready = await root.rpc("registration_invitation_ready");
    if (ready.error || ready.data !== true) return "failed";
    const claim = await root.rpc("claim_registration_invitation", { p_registration_id: registrationId, p_attempt_id: attemptId });
    if (claim.error || claim.data !== true) return "failed";
    let sent = false;
    try {
      const user = await root.auth.admin.getUserById(studentId);
      if (!user.error && user.data.user?.id === studentId && user.data.user.email?.toLowerCase() === email.toLowerCase()) {
        if (!user.data.user.email_confirmed_at) {
          const invitation = await root.auth.admin.inviteUserByEmail(email, { redirectTo: new URL("/auth/callback", origin).toString() });
          sent = !invitation.error && invitation.data.user?.id === studentId;
        } else if (process.env.REGISTRATION_RECOVERY_ENABLED === "true") {
          // Recovery is enabled only after configuring a token-hash recovery
          // template. A signed parameter prevents public provider recovery
          // requests from being accepted as administrator-authorized setup.
          const redirect = new URL("/auth/callback", origin);
          redirect.searchParams.set("registration_recovery", makeRegistrationRecoveryGrant(registrationId, studentId));
          const recovery = await root.auth.resetPasswordForEmail(email, { redirectTo: redirect.toString() });
          sent = !recovery.error;
        }
      }
    } catch { sent = false; }
    const completed = await root.rpc("complete_registration_invitation", { p_registration_id: registrationId, p_attempt_id: attemptId, p_succeeded: sent });
    return !completed.error && completed.data === true && sent ? "sent" : "failed";
  } catch { return "failed"; }
}
