export const QUESTION_PAGE_SIZE = 25;
export const SEARCH_DEBOUNCE_MS = 300;
export function scheduleQuestionSearch(run:()=>void){const timer=setTimeout(run,SEARCH_DEBOUNCE_MS);return()=>clearTimeout(timer);}
export type QuestionFilters = {subject:string;section:string;status:string;source:string;review:boolean;search:string;page:number};
export const emptyQuestionFilters:QuestionFilters = {subject:"",section:"",status:"",source:"",review:false,search:"",page:0};
export function readQuestionFilters(params:URLSearchParams):QuestionFilters {
  const page=Number(params.get("page")||1);
  return {subject:params.get("subject")||"",section:params.get("section")||"",status:params.get("status")||"",source:params.get("source")||"",review:params.get("review")==="1",search:params.get("search")||"",page:Number.isSafeInteger(page)&&page>0?Math.min(page-1,1_000_000):0};
}
export function questionFilterParams(filters:QuestionFilters) {
  const params=new URLSearchParams();
  for(const key of ["subject","section","status","source","search"] as const)if(filters[key])params.set(key,filters[key]);
  if(filters.review)params.set("review","1");if(filters.page)params.set("page",String(filters.page+1));return params;
}
export function changeQuestionFilter<K extends keyof QuestionFilters>(filters:QuestionFilters,key:K,value:QuestionFilters[K]):QuestionFilters {
  return {...filters,[key]:value,...(key!=="page"?{page:0}:{}),...(key==="subject"?{section:""}:{})};
}
export function literalLike(text:string){return `%${text.replace(/[\\%_]/g,"\\$&")}%`;}
// Quoted PostgREST values prevent punctuation in search text becoming filter syntax.
export function questionSearch(search:string,subjects:{id:string;name:string}[],chapters:{id:string;name:string}[]) {
  const term=search.trim();if(!term)return "";
  const pattern=JSON.stringify(literalLike(term));
  const clauses=["prompt","source_label","source_reference"].map(field=>`${field}.ilike.${pattern}`);
  if(/^\d{4}$/.test(term))clauses.push(`exam_year.eq.${Number(term)}`);
  for(const [column,items] of [["subject_id",subjects],["chapter_id",chapters]] as const){const ids=items.filter(x=>x.name.toLowerCase().includes(term.toLowerCase())).map(x=>x.id);if(ids.length)clauses.push(`${column}.in.(${ids.join(",")})`);}
  if("image-only question".includes(term.toLowerCase()))clauses.push('prompt.eq.""');
  return clauses.join(",");
}
export function questionExcerpt(prompt:string|null){return prompt?.trim().replace(/\s+/g," ").slice(0,280)||"Image-only question";}
