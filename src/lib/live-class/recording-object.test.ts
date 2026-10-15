import {describe,it,expect} from "vitest";
import {recordingObjectBelongs} from "./recording-object";
const session="425f82ec-5979-4c3e-9ae3-2bbb58ae767a",recording="ef10f3b0-d347-405c-90bf-2acb594d0bd4",segment="74038f3d-bd1f-49b7-84c7-b8c68ac21971";
const key=`recordings/2026/10/${session}/${recording}/${segment}/teacher-composite.webm`;
describe("recording asset ownership",()=>{
  it("accepts the canonical composite object for its exact class, recording and segment",()=>expect(recordingObjectBelongs(key,session,recording,segment)).toBe(true));
  it.each([0,1,2])("rejects a mismatched identity at position %s",position=>{const ids=[session,recording,segment];ids[position]="00000000-0000-0000-0000-000000000000";expect(recordingObjectBelongs(key,ids[0],ids[1],ids[2])).toBe(false);});
  it.each([`https://example.test/${key}`,key+"?signed=anything",key.replace("/10/","/13/"),key.replace("teacher-composite.webm","../private.webm"),"other-bucket-object"])("rejects untrusted or malformed object input %s",value=>expect(recordingObjectBelongs(value,session,recording,segment)).toBe(false));
});
