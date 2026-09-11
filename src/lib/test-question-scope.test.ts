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
