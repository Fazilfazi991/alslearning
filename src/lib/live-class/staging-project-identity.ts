import { createHash } from "node:crypto";

// Pin the approved project without storing its private reference.
const APPROVED_PROJECT_SHA256 = "79ee1da6e27b4fd8287ba8f298728171af7768db37b1569a010418a5cfb3198e";

export function isApprovedStagingProject(ref: string): boolean {
  return /^[a-z0-9]{20}$/.test(ref)
    && createHash("sha256").update(ref).digest("hex") === APPROVED_PROJECT_SHA256;
}
