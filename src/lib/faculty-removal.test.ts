import {beforeEach,describe,it,expect,vi} from "vitest";
const mock=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabase/client",()=>({createClient:()=>mock}));
import {removeFaculty} from "./faculty-directory";
describe("confirmed faculty removal",()=>{
  beforeEach(()=>mock.rpc.mockReset());
  it("returns the actual archived result rather than assuming deletion",async()=>{mock.rpc.mockResolvedValue({data:{id:"faculty",action:"archived"},error:null});expect(await removeFaculty("faculty")).toBe("archived")});
  it("never reports success for denied, missing or mismatched rows",async()=>{for(const result of [{error:{message:"denied"},data:null},{error:null,data:null},{error:null,data:{id:"another",action:"deleted"}}]){mock.rpc.mockResolvedValue(result);await expect(removeFaculty("faculty")).rejects.toThrow()}});
});
