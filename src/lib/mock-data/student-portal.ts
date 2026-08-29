export interface LiveClass { id:string; course:string; title:string; instructor:string; date:string; time:string; duration:string; status:"live"|"upcoming"|"recording"; resources?:number }
export interface ExamQuestion { id:number; topic:string; question:string; options:string[]; answer:number; explanation:string }
export interface StudentNotification { id:string; type:string; title:string; message:string; href:string; unread:boolean }

export const liveClasses:LiveClass[]=[
  {id:"clinical-enzyme-interpretation",course:"Clinical Biochemistry",title:"Clinical Enzyme Interpretation",instructor:"Dr. Sarah Ahmed",date:"03 September 2026",time:"7:30 PM",duration:"60 min",status:"live"},
  {id:"bacterial-identification",course:"Microbiology Essentials",title:"Bacterial Identification — Q&A",instructor:"Dr. Omar Hassan",date:"Tomorrow",time:"6:00 PM",duration:"45 min",status:"upcoming"},
  {id:"blood-cell-morphology",course:"Hematology Fundamentals",title:"Blood Cell Morphology Revision",instructor:"Dr. Lina Farouk",date:"Saturday",time:"5:00 PM",duration:"50 min",status:"upcoming"},
  {id:"clinical-chemistry-revision",course:"Clinical Biochemistry",title:"Clinical Chemistry Revision",instructor:"Dr. Sarah Ahmed",date:"03 Sep 2026",time:"Recorded",duration:"58 min",status:"recording",resources:3},
];

export const examQuestions:ExamQuestion[]=[
  {id:1,topic:"Enzymes",question:"Which enzyme is considered more liver-specific when evaluating hepatocellular injury?",options:["AST","ALT","CK","LDH"],answer:1,explanation:"ALT is concentrated more strongly in hepatocytes and is generally more liver-specific than AST."},
  {id:2,topic:"Liver Function",question:"A raised ALP with a raised GGT most strongly supports which source?",options:["Bone","Hepatobiliary","Skeletal muscle","Cardiac muscle"],answer:1,explanation:"Concurrent elevation of GGT supports a hepatobiliary source for increased ALP."},
  {id:3,topic:"Renal Function",question:"Which marker is routinely used to estimate glomerular filtration rate?",options:["Creatinine","Bilirubin","Albumin","Amylase"],answer:0,explanation:"Serum creatinine is used in equations that estimate GFR."},
  {id:4,topic:"Carbohydrate Metabolism",question:"HbA1c primarily reflects average glucose over approximately which period?",options:["24 hours","1 week","2–3 months","1 year"],answer:2,explanation:"HbA1c reflects glycation across the approximate lifespan of circulating red cells."},
  {id:5,topic:"Clinical Interpretation",question:"What should be considered first when a result is inconsistent with the clinical picture?",options:["Ignore it","Pre-analytical quality","Change the reference range","Report immediately"],answer:1,explanation:"Specimen identity, collection, transport and quality should be reviewed first."},
  {id:6,topic:"Enzymes",question:"AST may also be released in significant amounts from which tissue?",options:["Skeletal muscle","Thyroid","Adipose tissue","Skin"],answer:0,explanation:"AST is present in liver, cardiac muscle and skeletal muscle."},
  {id:7,topic:"Liver Function",question:"Which analyte best reflects hepatic synthetic function?",options:["ALT","Albumin","ALP","GGT"],answer:1,explanation:"Albumin is synthesized by the liver and contributes to assessment of synthetic function."},
  {id:8,topic:"Clinical Interpretation",question:"Why should enzyme results be interpreted as a pattern?",options:["Patterns remove all uncertainty","One value cannot provide tissue context alone","Reference ranges are optional","All enzymes have identical sources"],answer:1,explanation:"Magnitude, relationships, timing and clinical context provide more meaning than an isolated result."},
  {id:9,topic:"Renal Function",question:"Which condition can increase serum creatinine independently of acute kidney injury?",options:["Low muscle mass","High muscle mass","Low bilirubin","Low ALP"],answer:1,explanation:"Greater muscle mass can increase baseline creatinine production."},
  {id:10,topic:"Carbohydrate Metabolism",question:"Which test evaluates the response to a standardized glucose load?",options:["OGTT","INR","eGFR","Troponin"],answer:0,explanation:"The oral glucose tolerance test measures the response after a standardized glucose load."},
];

export const notifications:StudentNotification[]=[
  {id:"n1",type:"LIVE CLASS",title:"Clinical Chemistry Revision",message:"Begins in 30 minutes.",href:"/student/live-classes/clinical-enzyme-interpretation",unread:true},
  {id:"n2",type:"COURSE UPDATE",title:"Microbiology Essentials",message:"A new lesson has been added.",href:"/student/courses",unread:true},
  {id:"n3",type:"EXAM",title:"Clinical Biochemistry assessment",message:"Your assessment is tomorrow.",href:"/student/exams/clinical-biochemistry-final",unread:true},
  {id:"n4",type:"RESULT",title:"Microbiology result",message:"Your result is ready — 82%.",href:"/student/exams",unread:false},
  {id:"n5",type:"CERTIFICATE",title:"Clinical Biochemistry certificate",message:"Your certificate is ready.",href:"/student/certificates/clinical-biochemistry",unread:false},
];

export const progressCourses=[{name:"Clinical Biochemistry",value:100},{name:"Microbiology Essentials",value:74},{name:"Hematology Fundamentals",value:43},{name:"Medical Laboratory Technology",value:18}];
export const topicPerformance=[{name:"Clinical Chemistry",value:88},{name:"Enzymology",value:91},{name:"Microbiology",value:74},{name:"Hematology",value:68},{name:"Clinical Interpretation",value:61}];
