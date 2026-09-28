import { beforeEach, describe, expect, it, vi } from "vitest";

const writes = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn() }));

vi.mock("./supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== "enrollments") throw new Error(`Unexpected table: ${table}`);
      return {
        insert: async (value: Record<string, unknown>) => {
          writes.insert(value);
          return { error: null };
        },
        update: (value: Record<string, unknown>) => ({
          eq: async (field: string, id: string) => {
            writes.update(value, field, id);
            return { error: null };
          },
        }),
      };
    },
  }),
}));

import { saveEnrollment } from "./admin-backend";

describe("admin enrollment writes", () => {
  beforeEach(() => { writes.insert.mockClear(); writes.update.mockClear(); });

  it("inserts two separate Program enrollments for the same Student", async () => {
    await saveEnrollment({ student_id: "student", program_id: "program-a", batch_id: "batch-a" });
    await saveEnrollment({ student_id: "student", program_id: "program-b", batch_id: null });

    expect(writes.insert.mock.calls.map(([value]) => value.program_id)).toEqual(["program-a", "program-b"]);
    expect(writes.update).not.toHaveBeenCalled();
  });

  it("updates the selected enrollment row when Edit supplies its id", async () => {
    await saveEnrollment({ id: "enrollment-a", student_id: "student", program_id: "program-b" });

    expect(writes.update).toHaveBeenCalledWith(
      { id: "enrollment-a", student_id: "student", program_id: "program-b" },
      "id",
      "enrollment-a",
    );
    expect(writes.insert).not.toHaveBeenCalled();
  });
});
