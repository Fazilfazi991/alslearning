import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {act,create} from "react-test-renderer";
import {describe,expect,it,vi} from "vitest";
import {StudentExamList} from "./student-exam-list";
import {CoreTestEngine} from "./core-test-engine";
vi.mock("next/link",()=>({default:(props:Record<string,unknown>)=><a {...props}/> }));

const test={id:"t",slug:"practice",title:"Biochemistry Practice",type:"practice",duration_minutes:25,question_count:20,total_marks:20,available_from:null,available_until:null,program_id:"p",subjects:["Biochemistry"],attempts_used:0,max_attempts:null,last_score:null,state:"available" as const};
describe("Student Exams workflow",()=>{
 it("renders compact status navigation and configurable test metadata",()=>{const html=renderToStaticMarkup(<StudentExamList tests={[test,{...test,id:"m",slug:"mock",title:"Three Subject Mock",type:"mock",state:"upcoming"}]}/>);expect(html).toMatch(/Available[\s\S]*\(1\)/);expect(html).toMatch(/Upcoming[\s\S]*\(1\)/);expect(html).toContain("Unlimited attempts");expect(html).toContain("Practice test");});
 it("shows an unattempted closed test separately from completed results",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  let renderer!:ReturnType<typeof create>;
  await act(async()=>{renderer=create(<StudentExamList tests={[{...test,state:"closed",max_attempts:3}]}/>)});
  const tabs=renderer.root.findAllByProps({role:"tab"});
  expect(tabs.find(x=>x.children[0]==="Completed")?.findByType("span").children.join("")).toBe("(0)");
  const closed=tabs.find(x=>x.children[0]==="Closed");
  expect(closed?.findByType("span").children.join("")).toBe("(1)");
  await act(async()=>{closed!.props.onClick()});
  expect(renderer.root.findAllByType("a").some(x=>x.children.includes("View details"))).toBe(true);
  expect(renderer.root.findAllByType("a").some(x=>x.children.includes("View result"))).toBe(false);
  await act(async()=>renderer.unmount());
  vi.unstubAllGlobals();
 });
 it("shows details before start without revealing questions",()=>{const html=renderToStaticMarkup(<CoreTestEngine data={{test:{...test,instructions:"Read every option.",default_negative_marks:.25,pass_percentage:60,can_start:true},attempts:[]}}/>);expect(html).toContain("Test details");expect(html).toContain("Read every option.");expect(html).toContain("0.25 per wrong answer");expect(html).toContain("60%");expect(html).not.toContain("Question 1 of");});
 it("supports finite remaining attempts and unavailable starts",()=>{const html=renderToStaticMarkup(<CoreTestEngine data={{test:{...test,max_attempts:2,attempts_used:2,can_start:false},attempts:[{id:"a",status:"submitted",started_at:"2026-09-14T00:00:00Z",submitted_at:"2026-09-14T00:10:00Z",score:14,attempt_number:1}]}}/>);expect(html).toContain("0");expect(html).toContain("This test cannot be started");expect(html).toContain("View result");});
});
