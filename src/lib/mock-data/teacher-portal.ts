import type{Announcement,Assessment,AssessmentQuestion,Teacher,TeacherClass,TeacherCourse,TeacherNotification,TeacherStudent}from"@/types/teacher";
export const teacher:Teacher={name:"Dr. Sarah Ahmed",role:"Clinical Biochemistry Faculty",email:"sarah.ahmed@als.academy",mobile:"+971 50 284 1942",specialization:"Clinical Biochemistry",qualification:"PhD, Clinical Biochemistry",experience:"12 years",bio:"Laboratory educator focused on clinical interpretation, diagnostic enzymes, and evidence-based practice."};
export const teacherCourses:TeacherCourse[]=[
{id:"clinical-biochemistry",title:"Clinical Biochemistry",category:"Clinical Science",students:186,modules:12,lessons:31,progress:72,status:"Published",updated:"Today, 10:42 AM",image:"/images/courses/clinical-biochemistry.webp"},
{id:"microbiology-essentials",title:"Microbiology Essentials",category:"Microbiology",students:64,modules:10,lessons:24,progress:61,status:"Published",updated:"Yesterday",image:"/images/courses/microbiology-essentials.webp"},
{id:"hematology-fundamentals",title:"Hematology Fundamentals",category:"Hematology",students:34,modules:9,lessons:28,progress:48,status:"Draft",updated:"3 days ago",image:"/images/courses/hematology-fundamentals.webp"}];
export const teacherStudents:TeacherStudent[]=[
{id:"ameen-mohammed",name:"Ameen Mohammed",course:"Clinical Biochemistry",progress:72,lastActive:"Today",quizAverage:84,status:"On Track",studyTime:"14h 20m"},
{id:"fathima-n",name:"Fathima N",course:"Clinical Biochemistry",progress:38,lastActive:"5 days ago",quizAverage:61,status:"Needs Attention",studyTime:"8h 10m"},
{id:"rahul-kumar",name:"Rahul Kumar",course:"Microbiology Essentials",progress:21,lastActive:"9 days ago",quizAverage:58,status:"Inactive",studyTime:"5h 45m"},
{id:"mariam-ali",name:"Mariam Ali",course:"Hematology Fundamentals",progress:81,lastActive:"Today",quizAverage:90,status:"On Track",studyTime:"16h 05m"}];
export const teacherClasses:TeacherClass[]=[
{id:"clinical-enzyme-interpretation",title:"Clinical Enzyme Interpretation",course:"Clinical Biochemistry",date:"Today • 7:30 PM",batch:"CB-2026-A",students:186,status:"Upcoming"},
{id:"bacterial-identification",title:"Bacterial Identification Q&A",course:"Microbiology Essentials",date:"Tomorrow • 3:30 PM",batch:"MB-2026-A",students:64,status:"Upcoming"},
{id:"blood-cell-morphology",title:"Blood Cell Morphology Revision",course:"Hematology Fundamentals",date:"Sep 4 • 6:00 PM",batch:"HM-2026-A",students:34,status:"Draft"},
{id:"carbohydrate-review",title:"Carbohydrate Metabolism Review",course:"Clinical Biochemistry",date:"Aug 22 • 7:30 PM",batch:"CB-2026-A",students:172,status:"Past",duration:"58m",attendance:172}];
export const assessments:Assessment[]=[
{id:"clinical-biochemistry-final",title:"Final Assessment",course:"Clinical Biochemistry",questions:50,duration:60,students:186,status:"Published",completion:"172 / 186",average:81},
{id:"module-04-assessment",title:"Module 04 Assessment",course:"Clinical Biochemistry",questions:20,duration:30,students:186,status:"Draft"},
{id:"microbiology-midterm",title:"Microbiology Midterm",course:"Microbiology Essentials",questions:35,duration:45,students:64,status:"Completed",completion:"61 / 64",average:78}];
export const questionBank:AssessmentQuestion[]=[
{id:"q1",text:"Which enzyme marker is most liver-specific?",course:"Clinical Biochemistry",topic:"Clinical Interpretation",difficulty:"Medium",type:"Single Choice",usedIn:3},
{id:"q2",text:"Select all markers associated with cholestasis.",course:"Clinical Biochemistry",topic:"Diagnostic Enzymes",difficulty:"Hard",type:"Multiple Select",usedIn:2},
{id:"q3",text:"AST can originate from skeletal muscle.",course:"Clinical Biochemistry",topic:"Enzymology",difficulty:"Easy",type:"True / False",usedIn:5},
{id:"q4",text:"Interpret the supplied cardiac marker trend.",course:"Clinical Biochemistry",topic:"Cardiac Markers",difficulty:"Hard",type:"Case Based",usedIn:1}];
export const initialNotifications:TeacherNotification[]=[
{id:"n1",kind:"CLASS",message:"Clinical Biochemistry starts in 30 minutes.",read:false,time:"Now"},{id:"n2",kind:"ASSESSMENT",message:"12 submissions require attention.",read:false,time:"18m"},{id:"n3",kind:"STUDENT",message:"8 students inactive for 7+ days.",read:false,time:"1h"},{id:"n4",kind:"QUESTION",message:"New question for tonight's class.",read:true,time:"3h"},{id:"n5",kind:"COURSE",message:"Module 04 remains Draft.",read:true,time:"Yesterday"}];
export const initialAnnouncements:Announcement[]=[{id:"a1",title:"New revision material available",course:"Clinical Biochemistry",audience:"CB-2026-A",published:"Today",status:"Published"},{id:"a2",title:"Live class moved to 7:30 PM",course:"Microbiology Essentials",audience:"MB-2026-A",published:"Tomorrow",status:"Scheduled"}];
export const curriculumModules=[{title:"Introduction to Clinical Biochemistry",status:"Published",lessons:["Introduction to Clinical Biochemistry","Laboratory Reference Ranges","Sample Collection & Handling","Module 01 Check"]},{title:"Carbohydrate Metabolism",status:"Published",lessons:["Glucose Homeostasis","Diabetes Mellitus","Oral Glucose Tolerance Test","Module 02 Check"]},{title:"Enzymes",status:"Draft",lessons:["Introduction to Enzymes","Enzyme Classification","Clinical Enzymology","Diagnostic Enzyme Markers"]},{title:"Liver Function Tests",status:"Draft",lessons:["Bilirubin Metabolism","Liver Enzyme Patterns","Synthetic Function"]}];
