// This worktree is deployable only as ALS staging. Production builds fail
// closed for new classroom activity until an explicit bounded window exists.
export function stagingTestWindowOpen(now = Date.now()) {
  if (process.env.NODE_ENV !== "production" && process.env.ALS_STAGING_MODE !== "true") return true;
  const start = Date.parse(process.env.ALS_STAGING_TEST_START_UTC || "");
  const cutoff = Date.parse(process.env.ALS_STAGING_TEST_CUTOFF_UTC || "");
  const credentialExpiry = Date.parse(process.env.ALS_STAGING_CREDENTIAL_EXPIRES_UTC || "");
  return Number.isFinite(start) && Number.isFinite(cutoff) && Number.isFinite(credentialExpiry)
    && cutoff > start && cutoff - start <= 24 * 60 * 60_000
    && cutoff <= credentialExpiry && now >= start && now < cutoff;
}
