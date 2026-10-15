import {describe,it,expect} from "vitest";
import {recordingObjectBelongs} from "./recording-object";
const session="7385751c-3640-4db3-9a45-5348e682cffe",recording="ea83d954-a4ef-45b6-b34c-8b80722f3b04",segment="5d65817a-2a15-4013-9504-f81f8ece728c";
const key=`recordings/2026/10/${session}/${recording}/${segment}/teacher-composite.webm`;
describe("recording asset ownership",()=>{
  it("accepts the canonical composite object for its exact class, recording and segment",()=>expect(recordingObjectBelongs(key,session,recording,segment)).toBe(true));
  it.each([0,1,2])("rejects a mismatched identity at position %s",position=>{const ids=[session,recording,segment];ids[position]="00000000-0000-0000-0000-000000000000";expect(recordingObjectBelongs(key,ids[0],ids[1],ids[2])).toBe(false);});
  it.each([`https://example.test/${key}`,key+"?signed=anything",key.replace("/10/","/13/"),key.replace("teacher-composite.webm","../private.webm"),"other-bucket-object"])("rejects untrusted or malformed object input %s",value=>expect(recordingObjectBelongs(value,session,recording,segment)).toBe(false));
});
