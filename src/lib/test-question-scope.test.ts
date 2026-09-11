import { describe, expect, it } from "vitest";
import { newQuestion, newTest, type CoreData } from "./core-repository";
import { eligibleTestQuestions, testSelectionError } from "./test-question-scope";
const question = (id: string, subject_id = "micro", chapter_id = "m4", status = "active") => ({...newQuestion(), id, exam_id: "exam", program_id: "program", subject_id, chapter_id, status, difficulty: "easy"});
const data: CoreData = { exams: [], programs: [], subjects: [{id:"micro",name:"Microbiology"},{id:"patho",name:"Pathology"},{id:"bio",name:"Biochemistry"}], chapters: [{id:"m4",name:"MICRO 4",subject_id:"micro"},{id:"m1",name:"MICRO 1",subject_id:"micro"},{id:"p1",name:"PATHO 1",subject_id:"patho"}], topics: [], batches: [], questions: [question("a"),question("b","micro","m1"),question("c","patho","p1"),question("d","micro","m4","draft"),question("e","micro","m4","quarantine"),question("f","bio",""), {...question("g"),difficulty:"hard"}], tests: [], content: [], role: "admin", assignments: [], mappings: ["micro","patho","bio"].map(subject_id=>({program_id:"program",subject_id})) };
const test = {...newTest(),exam_id:"exam",program_id:"program",subject_id:"micro"};
describe("test academic scope",()=>{
 it("requires a subject before exposing any questions",()=>{expect(eligibleTestQuestions(data,{...test,subject_id:""})).toEqual([]);});
 it("all sections includes only active questions of the chosen subject",()=>{expect(eligibleTestQuestions(data,test).map(q=>q.id)).toEqual(["a","b","g"]);});
 it("restricts manual selection to the section",()=>{expect(eligibleTestQuestions(data,{...test,chapter_id:"m4"}).map(q=>q.id)).toEqual(["a","g"]);});
 it("rejects a section from another subject",()=>{expect(eligibleTestQuestions(data,{...test,chapter_id:"p1"})).toEqual([]);});
 it("supports future database subjects",()=>{expect(eligibleTestQuestions(data,{...test,subject_id:"bio"}).map(q=>q.id)).toEqual(["f"]);});
 it("random availability respects difficulty",()=>{expect(eligibleTestQuestions(data,{...test,selection_mode:"generated",selection_rules:{difficulty:"hard"}}).map(q=>q.id)).toEqual(["g"]);});
 it("blocks oversized random counts",()=>{expect(testSelectionError(data,{...test,selection_mode:"generated",question_count:4})).not.toBeNull(); expect(testSelectionError(data,{...test,selection_mode:"generated",question_count:3})).toBeNull();});
 it("rejects stale or unrelated manual selections",()=>{expect(testSelectionError(data,{...test,question_ids:["c"]})).not.toBeNull();expect(testSelectionError(data,{...test,question_ids:["a"]})).toBeNull();});
 it("preserves program, exam, topic and unsupported-type exclusions",()=>{for(const change of [{program_id:"other"},{exam_id:"other"},{type:"match_following"},{status:"review"}]) expect(eligibleTestQuestions({...data,questions:[{...question("a"),...change}]},test)).toEqual([]);});
});
import {inferTestScope,retainAllowedSelections} from "./test-question-scope";
describe("mixed subject regression",()=>{
 const mixed={...test,subject_id:"",question_ids:["a","c"]};
 it("infers existing mixed subjects and sections without losing IDs",()=>{
  const reopened=inferTestScope(data,mixed);
  expect(reopened.selection_rules.scopes).toEqual([{subject_id:"micro",chapter_ids:["m4"],count:1},{subject_id:"patho",chapter_ids:["p1"],count:1}]);
  expect(reopened.question_ids).toEqual(mixed.question_ids);
  expect(testSelectionError(data,reopened)).toBeNull();
 });
 it("round-trips persisted multiple-subject manual scope",()=>{
  const t=inferTestScope(data,mixed);
  expect(inferTestScope(data,JSON.parse(JSON.stringify(t)))).toEqual(t);
 });
 it("keeps cross-filter selections independent of visible rows",()=>{
  const t=inferTestScope(data,mixed);
  const filtered=eligibleTestQuestions(data,t).filter(q=>q.subject_id==="patho");
  expect(filtered.map(q=>q.id)).toEqual(["c"]);
  expect(t.question_ids).toEqual(["a","c"]);
  expect(testSelectionError(data,t)).toBeNull();
 });
 it("removes only questions in a removed allowed subject",()=>{
  const t=inferTestScope(data,mixed);
  expect(retainAllowedSelections(data,{...t,selection_rules:{scopes:[{subject_id:"micro",chapter_ids:[]}]}}).question_ids).toEqual(["a"]);
 });
 it("removes only questions outside a newly restricted section",()=>{
  const t={...inferTestScope(data,mixed),question_ids:["a","b","c"]};
  expect(retainAllowedSelections(data,t).question_ids).toEqual(["a","c"]);
 });
 it("validates each random quota independently and rejects fractional/oversized quotas",()=>{
  const t={...inferTestScope(data,mixed),selection_mode:"generated"};
  expect(testSelectionError(data,t)).toBeNull();
  for(const count of [0,1.5,99])expect(testSelectionError(data,{...t,selection_rules:{scopes:[{subject_id:"patho",chapter_ids:[],count}]}})).not.toBeNull();
 });
 it("distinguishes loading and failure from loaded-empty",()=>{
  const empty={...data,questions:[]};
  expect(testSelectionError(empty,test,"loading")).toContain("Loading");
  expect(testSelectionError(empty,test,"error")).toContain("Retry");
  expect(testSelectionError(empty,{...test,selection_mode:"generated"})).toBe("No active questions are available for this scope.");
 });
 it("never reports an impossible 1-to-0 range",()=>{
  for(const selection_mode of ["manual","generated"])expect(testSelectionError({...data,questions:[]},{...test,selection_mode})).not.toContain("1 and 0");
 });
 it("excludes Draft and Quarantine across every subject",()=>{
  expect(eligibleTestQuestions(data,inferTestScope(data,mixed)).map(q=>q.id)).toEqual(["a","c","g"]);
 });
});
