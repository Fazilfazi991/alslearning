import {describe,it,expect} from "vitest";
import {resolveLiveClassState,liveClassStateLabel} from "./state";
const now=Date.parse("2026-10-17T06:00:00Z");
describe("one classroom state",()=>{
 it.each([
  ["scheduled","2026-10-17T07:00:00Z",null,"scheduled"],
  ["scheduled","2026-10-17T05:00:00Z",null,"join_window_open"],
  ["live","2026-10-17T07:00:00Z",null,"live"],
  ["completed",null,null,"ended"],
  ["live",null,"2026-10-17T05:50:00Z","ended"],
  ["cancelled",null,null,"cancelled"],
 ])("resolves %s regardless of independent page labels",(status,join_opens_at,ended_at,expected)=>{
   expect(resolveLiveClassState({status,join_opens_at,ended_at},now)).toBe(expected);
 });
 it("uses Dubai offsets as instants once",()=>expect(resolveLiveClassState({status:"scheduled",join_opens_at:"2026-10-17T10:00:00+04:00"},now)).toBe("join_window_open"));
 it("does not invent a waiting room",()=>expect(liveClassStateLabel("join_window_open")).toBe("Join window open"));
});
