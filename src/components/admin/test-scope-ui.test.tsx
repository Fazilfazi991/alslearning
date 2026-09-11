import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TestForm } from "./core-manager";
import { TestQuestionPicker } from "./test-question-picker";
import { newQuestion, newTest, type CoreData } from "@/lib/core-repository";
const data: CoreData = {exams:[],programs:[],subjects:[{id:"micro",name:"Microbiology"}],chapters:[{id:"m4",name:"MICRO 4 — Parasitology",subject_id:"micro"},{id:"p1",name:"PATHO 1",subject_id:"patho"}],topics:[],batches:[],questions:[],tests:[],content:[],role:"admin",assignments:[],mappings:[{program_id:"program",subject_id:"micro"}]};
it("hides selection modes and question count until academic scope is chosen",()=>{
 const html=renderToStaticMarkup(<TestForm value={newTest()} data={data} busy={false} save={async()=>{}} />);
 expect(html).toContain("Choose a subject above");expect(html).not.toContain("Selection mode");expect(html).not.toContain("Number of questions");
});
it("shows database section options and scope summary before random controls",()=>{
 const html=renderToStaticMarkup(<TestForm value={{...newTest(),exam_id:"exam",program_id:"program",subject_id:"micro",selection_mode:"generated"}} data={data} busy={false} save={async()=>{}} />);
 expect(html).toContain("All Microbiology sections");expect(html).toContain("MICRO 4 — Parasitology");expect(html).not.toContain("PATHO 1");expect(html).toContain("Available Active Questions: 0");expect(html.indexOf("Academic scope")).toBeLessThan(html.indexOf("Selection mode"));expect(html).toContain("Number of questions");
});

it("paginates compact rows and exposes an explicit preview without preloading media",()=>{
 const questions=Array.from({length:25},(_,i)=>({...newQuestion(),id:String(i),prompt:i===0?"":"Question "+i,source_label:"Source Q"+i}));
 const html=renderToStaticMarkup(<TestQuestionPicker questions={questions} selected={["1"]} onChange={()=>{}} />);
 expect(html).toContain("Image-only question");expect(html).toContain("line-clamp-2");expect(html).toContain("Page 1 of 3");expect(html).not.toContain("Question 10");expect(html).toContain("Preview Image-only question");expect(html).not.toContain("Loading image");
});
it("shows per-subject quotas and a derived total without an editable combined random count",()=>{
 const d={...data,subjects:[...data.subjects,{id:"patho",name:"Pathology"}],mappings:[...data.mappings,{program_id:"program",subject_id:"patho"}]};
 const t={...newTest(),exam_id:"exam",program_id:"program",selection_mode:"generated",selection_rules:{scopes:[{subject_id:"micro",chapter_ids:[],count:2},{subject_id:"patho",chapter_ids:[],count:3}]}};
 const html=renderToStaticMarkup(<TestForm value={t} data={d} busy={false} save={async()=>{}}/>);
 expect(html).toContain("Total requested: 5");expect(html).not.toContain("Number of questions");expect(html).not.toContain("undefined");
 expect(html).toContain("No active questions are available for this scope.");
});
it("renders authorized lightweight bank rows without optional source labels",()=>{
 const q={...newQuestion(),prompt:"Assigned question",source_label:undefined!};
 expect(()=>renderToStaticMarkup(<TestQuestionPicker questions={[q]} selected={[]} onChange={()=>{}}/>)).not.toThrow();
});
