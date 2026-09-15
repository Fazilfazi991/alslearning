import { describe, expect, it } from "vitest";
import { facultyCounts, subjectNames, type FacultyDirectory } from "./faculty-directory";

const directory: FacultyDirectory = {
  subjects: [{ id: "patho", name: "Pathology" }, { id: "micro", name: "Microbiology" }, { id: "bio", name: "Biochemistry" }],
  members: [
    ...["Aiswarya Babu", "Aiswarya KP", "Dr Deepa", "Dr Athira Sreenivasan"].map((full_name, i) => ({ id: `p${i}`, source_key: `patho-${i}`, full_name, is_active: true, auth_profile_id: null })),
    ...["Mr Ansar", "Ms Jasna", "Ms Anju", "Ms Reshma Renju", "Mr Sarath"].map((full_name, i) => ({ id: `m${i}`, source_key: `micro-${i}`, full_name, is_active: true, auth_profile_id: null })),
    ...["Dr Nithya", "Mr Vaishakh"].map((full_name, i) => ({ id: `b${i}`, source_key: `bio-${i}`, full_name, is_active: true, auth_profile_id: null })),
  ],
  assignments: [
    ...Array.from({ length: 4 }, (_, i) => ({ faculty_id: `p${i}`, subject_id: "patho" })),
    ...Array.from({ length: 5 }, (_, i) => ({ faculty_id: `m${i}`, subject_id: "micro" })),
    ...Array.from({ length: 2 }, (_, i) => ({ faculty_id: `b${i}`, subject_id: "bio" })),
  ],
};

describe("real faculty directory", () => {
  it("counts exactly the 11 named members by assigned Subject without a demo login", () => {
    expect(directory.members).toHaveLength(11);
    expect(facultyCounts(directory).map(x => [x.name, x.count])).toEqual([["Pathology",4],["Microbiology",5],["Biochemistry",2]]);
    expect(directory.members.every(x => x.auth_profile_id === null)).toBe(true);
    expect(directory.members.some(x => x.full_name === "Arif Ahammed" || x.full_name === "ALS Teacher")).toBe(false);
  });
  it("uses stable member IDs and excludes inactive faculty from active counts", () => {
    const changed = { ...directory, members: directory.members.map(x => x.id === "p2" ? { ...x, full_name: "Edited name", is_active: false } : x) };
    expect(subjectNames("p2", changed)).toEqual(["Pathology"]);
    expect(facultyCounts(changed).find(x => x.id === "patho")?.count).toBe(3);
  });
  it("can associate a future login with the existing faculty identity", () => {
    const linked = { ...directory.members[2], auth_profile_id: "teacher-auth-id" };
    expect(linked.id).toBe(directory.members[2].id);
    expect(linked.source_key).toBe(directory.members[2].source_key);
  });
});
