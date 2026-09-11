import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TestForm } from "./core-manager";
import { newTest, type CoreData } from "@/lib/core-repository";
const data: CoreData = {exams:[],programs:[],subjects:[{id:"micro",name:"Microbiology"}],chapters:[{id:"m4",name:"MICRO 4 — Parasitology",subject_id:"micro"},{id:"p1",name:"PATHO 1",subject_id:"patho"}],topics:[],batches:[],questions:[],tests:[],content:[],role:"admin",assignments:[],mappings:[{program_id:"program",subject_id:"micro"}]};
it("hides selection modes and question count until academic scope is chosen",()=>{
 const html=renderToStaticMarkup(<TestForm value={newTest()} data={data} busy={false} save={async()=>{}} />);
 expect(html).toContain("Choose a subject above");expect(html).not.toContain("Selection mode");expect(html).not.toContain("Number of questions");
});
it("shows database section options and scope summary before random controls",()=>{
 const html=renderToStaticMarkup(<TestForm value={{...newTest(),exam_id:"exam",program_id:"program",subject_id:"micro",selection_mode:"generated"}} data={data} busy={false} save={async()=>{}} />);
 expect(html).toContain("All Microbiology sections");expect(html).toContain("MICRO 4 — Parasitology");expect(html).not.toContain("PATHO 1");expect(html).toContain("Available Active Questions: 0");expect(html.indexOf("Academic scope")).toBeLessThan(html.indexOf("Selection mode"));expect(html).toContain("Number of questions");
});
