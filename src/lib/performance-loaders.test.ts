import { beforeEach, describe, expect, it, vi } from "vitest";

const mock=vi.hoisted(()=>({
  tables:[] as {name:string;calls:string[]}[],
  metadata:vi.fn(),
  failure:"",
}));
vi.mock("./test-repository",()=>({loadAcademicMetadata:mock.metadata,loadTestWorkspace:vi.fn()}));
vi.mock("./supabase/client",()=>({createClient:()=>({
  auth:{getUser:vi.fn(()=>{throw Error("Server identity should be reused")})},
  from:(name:string)=>{
    const record={name,calls:[] as string[]};mock.tables.push(record);
    const chain:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({
      data:name==="learning_content"?[{id:"content",title:"Lesson",content_batch_access:[]}]:[],
      error:mock.failure===name?{message:"private detail"}:null,
    }).then(resolve)};
    for(const method of ["select","eq","order","limit"])chain[method]=(...args:unknown[])=>{void args;record.calls.push(method);return chain;};
    return chain;
  },
})}));
import { loadCoreData } from "./core-repository";
import { loadAdminData } from "./admin-backend";

const academic={exams:[],programs:[],subjects:[],chapters:[],topics:[],batches:[],mappings:[]};
describe("page-specific data contracts",()=>{
  beforeEach(()=>{mock.tables=[];mock.failure="";mock.metadata.mockReset().mockResolvedValue(academic);});
  it("loads Courses metadata without the bank, keys, options, media or tests",async()=>{
    const data=await loadCoreData("content",{id:"admin",role:"admin"});
    expect(mock.metadata).toHaveBeenCalledWith("admin");
    expect(mock.tables.map(table=>table.name)).toEqual(["learning_content","faculty_assignments"]);
    expect(data.questions).toEqual([]);expect(data.tests).toEqual([]);
  });
  it("retains scoped Teacher Content and never resolves a second Auth identity",async()=>{
    await loadCoreData("content",{id:"teacher",role:"teacher"});
    expect(mock.metadata).toHaveBeenCalledWith("teacher");
    expect(mock.tables.map(table=>table.name)).toEqual(["learning_content","faculty_assignments"]);
  });
  it("does not fall back to the old full-bank Question Bank loader",async()=>{
    await expect(loadCoreData("questions",{id:"teacher",role:"teacher"})).rejects.toThrow("paginated Question Bank");
    expect(mock.tables).toEqual([]);
  });
  it.each([
    ["enrollments",["profiles","programs","batches","enrollments"]],
    ["faculty",["profiles","programs","batches","subjects","faculty_assignments","batch_faculty"]],
  ] as const)("loads only %s domain records",async(mode,expected)=>{
    await loadAdminData(mode);
    expect(mock.tables.map(table=>table.name).sort()).toEqual([...expected].sort());
    expect(mock.tables.some(table=>["questions","question_options","question_answer_keys","question_media"].includes(table.name))).toBe(false);
  });
  it("does not present a failed list as an empty successful result",async()=>{
    mock.failure="enrollments";
    await expect(loadAdminData("enrollments")).rejects.toThrow("private detail");
  });
});
