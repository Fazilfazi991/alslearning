export type CourseStatus = "in-progress" | "completed";
export interface Course { id:string; slug:string; title:string; category:string; lessons:number; duration:string; difficulty:string; instructor:string; progress:number; status:CourseStatus; certificate?:boolean; description:string }
export interface Lesson { id:string; slug:string; title:string; duration:string; completed:boolean; current?:boolean }
export interface CourseModule { id:string; number:string; title:string; progress:string; lessons:Lesson[] }
export interface Resource { id:string; title:string; size?:string; type:"PDF"|"Guide" }
export interface Assessment { id:string; title:string; status:"Completed"|"Available"|"Locked"; score?:string; detail?:string }
