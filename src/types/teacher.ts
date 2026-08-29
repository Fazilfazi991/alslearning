export type TeacherStatus="Published"|"Draft"|"Archived";
export type StudentStatus="On Track"|"Needs Attention"|"Inactive";
export interface Teacher{ name:string;role:string;email:string;mobile:string;specialization:string;qualification:string;experience:string;bio:string }
export interface TeacherCourse{id:string;title:string;category:string;students:number;modules:number;lessons:number;progress:number;status:TeacherStatus;updated:string;image:string}
export interface TeacherStudent{id:string;name:string;course:string;progress:number;lastActive:string;quizAverage:number;status:StudentStatus;studyTime:string}
export interface TeacherClass{id:string;title:string;course:string;date:string;batch:string;students:number;status:"Upcoming"|"Past"|"Draft";duration?:string;attendance?:number}
export interface Assessment{id:string;title:string;course:string;questions:number;duration:number;students:number;status:"Published"|"Draft"|"Completed";completion?:string;average?:number}
export interface AssessmentQuestion{id:string;text:string;course:string;topic:string;difficulty:"Easy"|"Medium"|"Hard";type:"Single Choice"|"Multiple Select"|"True / False"|"Image Based"|"Case Based";usedIn:number}
export interface TeacherNotification{id:string;kind:"CLASS"|"ASSESSMENT"|"STUDENT"|"QUESTION"|"COURSE";message:string;read:boolean;time:string}
export interface Announcement{id:string;title:string;course:string;audience:string;published:string;status:"Published"|"Scheduled"}
