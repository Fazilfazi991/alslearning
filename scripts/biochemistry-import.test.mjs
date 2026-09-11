import {readFileSync,existsSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {sourceIdentity,questionPayload,classify,chapterNames} from "./biochemistry-import-model.mjs";
const file=".local-qa/biochemistry-preflight-records.json";
const rows=existsSync(file)?JSON.parse(readFileSync(file,"utf8")):[];
const taxonomy={exam:{id:"exam"},subject:{id:"subject"},chapters:chapterNames.map((name,i)=>({name,id:`chapter-${i}`}))};
describe.skipIf(!rows.length)("Biochemistry deterministic import",()=>{
  it("maps 708 Active, five Draft, one manifest-only quarantine",()=>{
    expect(["active","draft","quarantine"].map(s=>rows.filter(q=>classify(q)===s).length)).toEqual([708,5,1]);
    expect(()=>questionPayload(rows.find(q=>classify(q)==="quarantine"),taxonomy)).toThrow();
  });
  it("uses exact filename, hash, BIO subhead and sequence in distinct identities",()=>{
    expect(new Set(rows.map(sourceIdentity)).size).toBe(714);
    const q=rows[0],id=sourceIdentity(q);
    for(const change of [{source_document:"different.docx"},{source_sha256:"different"},{bio:9},{source_sequence:999}])expect(sourceIdentity({...q,...change})).not.toBe(id);
    for(const q of rows)expect(sourceIdentity(q)).toBe(q.scoped_source_identity);
  });
  it("preserves all payload text, tables, option order, keys and scientific AST",()=>{
    for(const q of rows.filter(q=>classify(q)!=="quarantine")){
      const p=questionPayload(q,taxonomy);
      expect(p.prompt_rich).toEqual(q.prompt_rich);expect(p.explanation_rich).toEqual(q.explanation_rich);
      expect(p.options).toEqual(q.options.map(o=>({content:o.content,content_rich:o.content_rich,correct:o.correct})));
      expect(p.media).toEqual([]);expect(p.type).toBe("single_mcq");
      expect(questionPayload(q,taxonomy)).toEqual(p);
    }
  });
  it("keeps PSC shorthand without inventing a four-digit year",()=>{
    const p=questionPayload(rows.find(q=>q.bio===8&&q.source_sequence===24),taxonomy);
    expect(p.source_reference).toBe("PSC 063/23");expect(p.source_type).toBe("previous_exam");expect(p.exam_year).toBeNull();
  });
  it("keeps numberless stems unchanged with separate traceability",()=>{
    for(const q of rows.filter(q=>q.displayed_number===null)){
      const p=questionPayload(q,taxonomy);expect(p.prompt).toBe(q.prompt);expect(p.source_label).toContain("visible=absent");
    }
  });
  it("retains all five original review keys and solutions",()=>{
    const draft=rows.filter(q=>classify(q)==="draft");expect(draft.map(q=>q.source_sequence)).toEqual([73,77,135,172,188]);
    for(const q of draft){const p=questionPayload(q,taxonomy);expect(p.explanation).toBe(q.explanation);expect(p.source_label).toContain("CONTENT REVIEW REQUIRED");}
  });
  it("fails closed if meaningful media appears",()=>expect(()=>questionPayload({...rows[0],media:[{}]},taxonomy)).toThrow("Unexpected media"));
});
