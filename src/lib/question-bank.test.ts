import {afterEach,describe,expect,it,vi} from "vitest";
import {emptyQuestionFilters,changeQuestionFilter,readQuestionFilters,questionFilterParams,questionSearch,questionExcerpt,scheduleQuestionSearch} from "./question-bank";
describe("question bank filters",()=>{
  afterEach(()=>vi.useRealTimers());
  it("round trips filters and page through the URL",()=>{const f={...emptyQuestionFilters,subject:"s",section:"c",status:"draft",source:"standard",review:true,search:"Na+ / DNA",page:4};expect(readQuestionFilters(questionFilterParams(f))).toEqual(f);});
  it.each(["-1","0","no","2.5"])("rejects invalid page %s",page=>expect(readQuestionFilters(new URLSearchParams({page})).page).toBe(0));
  it("resets page and dependent section on subject change",()=>expect(changeQuestionFilter({...emptyQuestionFilters,page:4,section:"old"},"subject","new")).toMatchObject({subject:"new",section:"",page:0}));
  it.each(["status","section","source","search"] as const)("resets pagination for %s",key=>expect(changeQuestionFilter({...emptyQuestionFilters,page:3},key,"value").page).toBe(0));
  it("preserves scope for next page",()=>expect(changeQuestionFilter({...emptyQuestionFilters,subject:"s",section:"c"},"page",2)).toMatchObject({subject:"s",section:"c",page:2}));
  it("searches existing text and database-driven taxonomy names",()=>{const search=questionSearch("BIO",[{id:"s",name:"Biochemistry"}],[{id:"c",name:"BIO 4"}]);expect(search).toContain('prompt.ilike.');expect(search).toContain('source_reference.ilike.');expect(search).toContain('source_label.ilike.');expect(search).toContain('subject_id.in.(s)');expect(search).toContain('chapter_id.in.(c)');});
  it("searches year and image-only fallback",()=>{expect(questionSearch("2025",[],[])).toContain("exam_year.eq.2025");expect(questionSearch("Image-only question",[],[])).toContain('prompt.eq.""');});
  it("quotes PostgREST punctuation and literal wildcards",()=>{const result=questionSearch('a%,x.eq.y_("',[],[]);expect(result).toContain(JSON.stringify('%a\\%,x.eq.y\\_("%'));});
  it("debounces rapid changes and cancels an unmounted search",()=>{vi.useFakeTimers();const run=vi.fn();const first=scheduleQuestionSearch(run);vi.advanceTimersByTime(200);first();const second=scheduleQuestionSearch(run);vi.advanceTimersByTime(299);expect(run).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(run).toHaveBeenCalledTimes(1);second();const unmount=scheduleQuestionSearch(run);unmount();vi.runAllTimers();expect(run).toHaveBeenCalledTimes(1);});
  it("bounds long previews without modifying source, and labels image-only stems",()=>{const prompt="A".repeat(2000);expect(questionExcerpt(prompt)).toHaveLength(280);expect(prompt).toHaveLength(2000);expect(questionExcerpt("")).toBe("Image-only question");});
});
