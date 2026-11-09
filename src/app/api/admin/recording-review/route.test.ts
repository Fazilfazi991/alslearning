import {beforeEach,describe,expect,it,vi} from "vitest";

const mock=vi.hoisted(()=>({range:vi.fn(),count:vi.fn(),filters:[] as string[]}));
vi.mock("@/lib/admin-session",()=>({adminSession:async()=>({user:{id:"admin"},db:{from:()=>{
  const chain={select:()=>chain,eq:(key:string,value:string|boolean)=>{mock.filters.push(`${key}=${value}`);return chain;},neq:(key:string,value:string)=>{mock.filters.push(`${key}!=${value}`);return chain;},order:()=>chain,range:mock.range,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(mock.count()).then(resolve)};
  return chain;
}}})}));
vi.mock("@/lib/live-class/recording-storage",()=>({r2RecordingStorage:{verify:vi.fn()}}));
import {GET} from "./route";

describe("recording review pagination",()=>{
  beforeEach(()=>{vi.resetAllMocks();mock.filters.length=0;});
  it("returns an empty page and actual count after the queue shrinks",async()=>{
    mock.range.mockResolvedValue({error:{code:"PGRST103"},data:null,count:null});
    mock.count.mockReturnValue({error:null,count:2});
    const response=await GET(new Request("https://als.example/api/admin/recording-review?page=1&view=published"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({recordings:[],total:2});
    expect(mock.filters.filter(value=>value==="status=published")).toHaveLength(2);
  });
  it("does not hide unrelated database failures",async()=>{
    mock.range.mockResolvedValue({error:{code:"42501"},data:null});
    const response=await GET(new Request("https://als.example/api/admin/recording-review?page=1"));
    expect(response.status).toBe(503);
    expect(mock.count).not.toHaveBeenCalled();
  });
  it("reports failure when the fallback count cannot be read",async()=>{
    mock.range.mockResolvedValue({error:{code:"PGRST103"},data:null});
    mock.count.mockReturnValue({error:{code:"42501"},count:null});
    expect((await GET(new Request("https://als.example/api/admin/recording-review?page=1"))).status).toBe(503);
  });
});
