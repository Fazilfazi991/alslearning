export type AccountStatus="Active"|"Inactive"|"Suspended"|"Pending";
export interface AdminStudent{id:string;name:string;email:string;courses:number;progress:number;lastActive:string;status:AccountStatus;joined:string}
export interface AdminTeacher{id:string;name:string;specialization:string;courses:number;students:number;classes:number;status:AccountStatus;lastActive:string}
export interface Batch{id:string;course:string;teacher:string;students:number;start:string;end:string;status:"Active"|"Upcoming"|"Completed"}
export interface Payment{id:string;student:string;course:string;amount:number;method:string;status:"Paid"|"Pending"|"Failed"|"Refunded";date:string}
export interface Certificate{id:string;student:string;course:string;completed:string;issued:string;status:"Issued"|"Eligible"|"Revoked"}
export interface AuditEvent{id:string;date:string;user:string;action:string;entity:string;details:string}
export interface SupportTicket{id:string;user:string;role:"Student"|"Teacher";topic:string;priority:"High"|"Medium"|"Low";status:"Open"|"In Progress"|"Resolved";created:string}
export interface CmsSection{id:string;name:string;visible:boolean}
