import { beforeEach, describe, expect, it, vi } from "vitest";

const cleanup = vi.hoisted(() => ({ closeProviderTracks: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./transport-cleanup", () => cleanup);

import { reconcileClassTransport } from "./transport-reconciliation";

describe("reconcileClassTransport", () => {
  beforeEach(() => vi.resetAllMocks());

  it("normalizes stale rows with terminal provider evidence without another provider call", async () => {
    const updates: { table: string; values: Record<string, unknown>; ids: string[] }[] = [];
    const publication = {
      id: "publication-a",
      connection_id: "connection-a",
      provider_mid: "mid-a",
      status: "closing",
      cleanup_attempts: 1,
      cleanup_retry_at: null,
      provider_reconciliation_outcome: "confirmed_closed",
      live_media_connections: { provider_session_id: "receiver-a", publisher_provider_session_id: "publisher-a", status: "closed" },
    };
    const subscription = {
      ...publication,
      id: "subscription-a",
      provider_reconciliation_outcome: "confirmed_absent_or_expired",
    };
    const db = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => table === "live_published_tracks"
              ? Promise.resolve({ data: [publication], error: null })
              : { not: vi.fn().mockResolvedValue({ data: [subscription], error: null }) }),
          })),
        })),
        update: vi.fn((values: Record<string, unknown>) => ({
          in: vi.fn(async (_column: string, ids: string[]) => {
            updates.push({ table, values, ids });
            return { error: null };
          }),
        })),
      })),
    };

    await expect(reconcileClassTransport(db as never, "class-a")).resolves.toMatchObject({
      closedPublications: 1,
      closedSubscriptions: 1,
      failedPublications: 0,
      failedSubscriptions: 0,
    });
    expect(cleanup.closeProviderTracks).not.toHaveBeenCalled();
    expect(updates).toHaveLength(2);
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "live_published_tracks", ids: ["publication-a"], values: expect.objectContaining({ status: "closed" }) }),
      expect.objectContaining({ table: "live_track_subscriptions", ids: ["subscription-a"], values: expect.objectContaining({ status: "closed" }) }),
    ]));
  });
});
