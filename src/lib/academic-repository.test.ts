import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AcademicEntity } from "../types/academic";

const { updates, upserts } = vi.hoisted(() => ({ updates: vi.fn(), upserts: vi.fn() }));

vi.mock("./supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => ({
        order: async () => ({
          data: table === "batches"
            ? [
                { id: "upcoming-batch", name: "Upcoming", slug: "upcoming", status: "upcoming", program_id: "program" },
                { id: "completed-batch", name: "Completed", slug: "completed", status: "completed", program_id: "program" },
              ]
            : [],
          error: null,
        }),
      }),
      update: (value: { status: string }) => ({
        eq: async (field: string, id: string) => {
          updates(table, value, field, id);
          return { error: null };
        },
      }),
      upsert: async (value: { status: string }) => {
        upserts(table, value);
        return { error: null };
      },
    }),
  }),
}));

import { archiveAcademicEntity, deleteAcademicEntity, loadAcademicWorkspace, saveAcademicEntity } from "./academic-repository";

describe("academic batch status", () => {
  beforeEach(() => { updates.mockClear(); upserts.mockClear(); });

  it("keeps upcoming and completed batches distinct in the workspace", async () => {
    const workspace = await loadAcademicWorkspace();
    expect(workspace.entities.map(item => [item.id, item.status])).toEqual([
      ["upcoming-batch", "Upcoming"],
      ["completed-batch", "Completed"],
    ]);
  });

  it("restores an archived batch to upcoming in persistence and UI state", async () => {
    const archived = { id: "upcoming-batch", kind: "batch", status: "Archived" } as AcademicEntity;
    expect(await archiveAcademicEntity(archived)).toBe("Upcoming");
    expect(updates).toHaveBeenCalledWith("batches", { status: "upcoming" }, "id", "upcoming-batch");
  });

  it("persists an explicitly completed batch without changing it to upcoming", async () => {
    const completed = { id: "completed-batch", kind: "batch", status: "Completed", parentId: "program", name: "Completed", slug: "completed" } as AcademicEntity;
    await saveAcademicEntity(completed, []);
    expect(upserts).toHaveBeenCalledWith("batches", expect.objectContaining({ id: "completed-batch", status: "completed" }));
  });

  it("rejects batch-only states for other academic entities", async () => {
    const subject = { id: "subject", kind: "subject", status: "Completed" } as unknown as AcademicEntity;
    await expect(saveAcademicEntity(subject, [])).rejects.toThrow("only available for batches");
    expect(upserts).not.toHaveBeenCalled();
  });

  it("prevents batch deletion because it could detach an enrollment", async () => {
    const upcoming = { id: "upcoming-batch", kind: "batch", status: "Upcoming" } as AcademicEntity;
    await expect(deleteAcademicEntity(upcoming)).rejects.toThrow("could change Student access");
  });
});
