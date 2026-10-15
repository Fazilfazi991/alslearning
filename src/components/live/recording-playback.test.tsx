import {act,create,type ReactTestRenderer,type ReactTestInstance} from "react-test-renderer";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {RecordingPlayback} from "./recording-playback";

vi.mock("next/link",()=>({default:(props:Record<string,unknown>)=><a {...props}/>}));
let renderer:ReactTestRenderer;
let browser:EventTarget;
let documentEvents:EventTarget;
const fetchMock=vi.fn(),pause=vi.fn();
const reply=(status:number,value:unknown)=>({status,ok:status>=200&&status<300,json:async()=>value});
const playback=()=>({segments:[{id:"segment",segmentNumber:1,mimeType:"video/webm",durationSeconds:90,byteLength:100,url:"https://storage.invalid/test-class",expiresAt:new Date(Date.now()+900000).toISOString()}]});
const content=(node:ReactTestInstance):string=>node.children.map(child=>typeof child==="string"?child:content(child)).join("");
const renewButton=()=>renderer.root.findAllByType("button").find(b=>content(b).includes("Renew playback"))!;
const mount=async()=>{
  await act(async()=>{renderer=create(<RecordingPlayback classId="class" recordingId="recording" title="Class"/>,{createNodeMock:element=>element.type==="video"?{pause,currentTime:40,paused:false,ended:false}:null});});
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(renderer.root.findAllByType("video")).toHaveLength(1);
};
beforeEach(()=>{
  vi.useFakeTimers();vi.clearAllMocks();browser=new EventTarget();documentEvents=new EventTarget();
  Object.assign(browser,{setTimeout,clearTimeout,setInterval,clearInterval});Object.assign(documentEvents,{visibilityState:"visible"});
  vi.stubGlobal("window",browser);vi.stubGlobal("document",documentEvents);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("fetch",fetchMock);
  fetchMock.mockImplementation(async(url:string)=>reply(200,url.includes("access=1")?{allowed:true}:playback()));
});
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());vi.useRealTimers();vi.unstubAllGlobals();});

describe("open recording authorization",()=>{
  it("checks authorization without replacing a healthy playback source",async()=>{
    await mount();await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});
    expect(fetchMock.mock.calls.filter(([url])=>!url.includes("access=1"))).toHaveLength(1);
    expect(renderer.root.findByType("video").props.src).toBe("https://storage.invalid/test-class");expect(pause).not.toHaveBeenCalled();
  });
  it.each([401,403,404])("pauses and removes an existing player after authorization returns %s",async status=>{
    await mount();fetchMock.mockImplementation(async()=>reply(status,{error:"Access removed"}));
    await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});
    expect(pause).toHaveBeenCalled();expect(renderer.root.findAllByType("video")).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("no longer available");
  });
  it("removes cached media when a manual link renewal is denied",async()=>{
    await mount();fetchMock.mockResolvedValue(reply(404,{error:"Class unpublished"}));
    await act(async()=>{renewButton().props.onClick();});
    expect(renderer.root.findAllByType("video")).toHaveLength(0);expect(pause).toHaveBeenCalled();
  });
  it("does not restore a revoked player from a delayed earlier renewal",async()=>{
    await mount();let finishRenewal:((value:ReturnType<typeof reply>)=>void)|undefined;
    fetchMock.mockImplementation((url:string)=>url.includes("access=1")?Promise.resolve(reply(403,{error:"Access removed"})):new Promise(resolve=>{finishRenewal=resolve;}));
    await act(async()=>{renewButton().props.onClick();});
    await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});
    expect(renderer.root.findAllByType("video")).toHaveLength(0);
    await act(async()=>{finishRenewal!(reply(200,playback()));});
    expect(renderer.root.findAllByType("video")).toHaveLength(0);
  });
  it("rechecks immediately when the browser regains focus",async()=>{
    await mount();fetchMock.mockResolvedValue(reply(403,{error:"Access removed"}));
    await act(async()=>{browser.dispatchEvent(new Event("focus"));});
    expect(renderer.root.findAllByType("video")).toHaveLength(0);
  });
});
