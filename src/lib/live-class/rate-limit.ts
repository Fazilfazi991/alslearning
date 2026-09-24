import "server-only";

type Window = { count: number; resetsAt: number };
const windows = new Map<string, Window>();

/** A per-instance abuse guard. Database constraints and provider limits remain authoritative. */
export function consumeLiveRateLimit(key: string, limit = 90, windowMs = 60_000) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetsAt <= now) {
    windows.set(key, { count: 1, resetsAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  current.count += 1;
  if (current.count <= limit) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetsAt - now) / 1000)) };
}
