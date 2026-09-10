import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {clients,ok} from "./pathology-client.mjs";
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const {root}=await clients();
const qa=JSON.parse(readFileSync(".local-qa/pathology-acceptance.json","utf8"));
const manifest=JSON.parse(readFileSync("docs/pathology-import-manifest.json","utf8"));
const input=JSON.parse(readFileSync(".local-qa/pathology-import-input.json","utf8"));
const origin="http://localhost:3004",results=[],errors=[],attemptIds=[];
const browser=await chromium.launch({headless:true,channel:"msedge"});
const check=(name,value)=>{assert.ok(value,name);results.push(name);console.log("PASS",name);};
async function session(role,width){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1000}}),page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 const link=ok(await root.auth.admin.generateLink({type:"magiclink",email:qa.fixture.users[role].email}));
 await page.goto(`${origin}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink`);return {context,page};
}
const filter=(page,label)=>page.getByRole("combobox",{name:new RegExp(`^${label}`)});
async function count(page,n){await page.getByText(`${n} records`,{exact:true}).waitFor();}
async function overflow(page,label){check(label,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
async function openQuestion(page,subhead,sequence){
 await filter(page,"Filter by chapter").selectOption(manifest.taxonomy.chapters[subhead-1].id);
 await page.getByRole("textbox",{name:"Search",exact:true}).fill(`| Q${sequence} |`);
 await count(page,1);await page.getByRole("button",{name:"View / edit",exact:true}).click();
 await page.getByRole("button",{name:"Save question",exact:true}).waitFor();
}
async function save(page){await page.getByRole("button",{name:"Save question",exact:true}).click();await page.getByRole("heading",{name:"Edit question",exact:true}).waitFor({state:"hidden",timeout:90000});}
try{
 for(const width of [1440,390]){
  const {context,page}=await session("admin",width);
  await page.goto(`${origin}/admin/questions`);await page.getByRole("textbox",{name:"Search",exact:true}).fill("Pathology");await count(page,966);
  check(`Admin ${width}: search Pathology finds 966 imported records`,true);
  await filter(page,"Filter by subject").selectOption(manifest.taxonomy.subject.id);
  for(const [i,c] of manifest.taxonomy.chapters.entries()){await filter(page,"Filter by chapter").selectOption(c.id);await count(page,[310,136,168,99,148,105][i]);}
  check(`Admin ${width}: all six chapter filters reconcile`,true);
  await filter(page,"Filter by chapter").selectOption("");await filter(page,"Filter by status").selectOption("active");await count(page,961);
  await filter(page,"Filter by status").selectOption("draft");await page.getByRole("checkbox",{name:"Content review required only",exact:true}).check();await count(page,5);
  check(`Admin ${width}: five review drafts identifiable`,await page.getByText("Content review required",{exact:true}).count()===5);
  await page.getByRole("checkbox",{name:"Content review required only",exact:true}).uncheck();await filter(page,"Filter by status").selectOption("");
  await filter(page,"Filter by source").selectOption("previous_exam");await count(page,79);
  check(`Admin ${width}: previous-paper filter finds 79`,true);
  await filter(page,"Filter by source").selectOption("");
  for(const [subhead,sequence] of [[2,126],[4,68]]){
   await openQuestion(page,subhead,sequence);
   check(`Admin ${width}: PATHO ${subhead} Q${sequence} superscript survives database`,await page.locator("sup").count()>0);
   await overflow(page,`Admin ${width}: formatted editor fits`);
   await page.screenshot({path:`.local-qa/pathology-admin-${width}-${subhead}.png`});await save(page);
  }
  await openQuestion(page,1,190);
  check(`Admin ${width}: Q190 remains draft`,await filter(page,"Publication status").inputValue()==="draft");
  for(const summary of await page.locator("summary").all())if((await summary.innerText()).includes("preview"))await summary.click();
  await page.waitForFunction(()=>document.querySelectorAll('img[alt^="Solution images"]').length===4&&[...document.querySelectorAll('img[alt^="Solution images"]')].every(i=>i.complete&&i.naturalWidth>0));
  check(`Admin ${width}: Q190 four images and original GIF render`,await page.locator('img[src*=".gif"]').count()===1);
  await page.screenshot({path:`.local-qa/pathology-q190-${width}.png`});await save(page);
  // Open a genuine previous-paper record and verify structured metadata against the source.
  const paper=input.find(q=>q.subhead===6&&q.source_reference_candidates.length);
  await openQuestion(page,6,paper.source_sequence);await page.getByText("Source / previous-paper metadata",{exact:true}).click();
  check(`Admin ${width}: exact previous-paper reference/year visible`,await page.getByLabel("Exam reference",{exact:true}).inputValue()===paper.source_reference_candidates[0]&&await page.getByLabel("Year",{exact:true}).inputValue()===paper.source_reference_candidates[0].split("/")[1]);await save(page);
  await context.close();
  const learner=await session("second",width),sp=learner.page;let activePayload=null;
  sp.on("response",async response=>{if(response.url().includes("/rpc/core_attempt_payload")&&response.ok()){const data=await response.json();if(data.status==="in_progress")activePayload=data;}});
  await sp.goto(`${origin}/student/exams/${qa.test_slug}`);await sp.getByRole("button",{name:"Start attempt",exact:true}).click();await sp.getByRole("button",{name:"Submit test",exact:true}).waitFor();
  await sp.waitForTimeout(300);
  check(`Student ${width}: only intended active questions from all six chapters`,activePayload?.questions.length===qa.question_ids.length&&activePayload.questions.every(q=>qa.question_ids.includes(q.id)));
  check(`Student ${width}: keys/explanations/solution media absent from network payload`,activePayload.questions.every(q=>!["correct_ids","explanation","explanation_rich","solution_media","explanation_image_path"].some(k=>k in q)));
  attemptIds.push(activePayload.id);
  for(const [index,selection] of qa.selections.entries()){
   const source=input.find(q=>q.subhead===selection.subhead&&q.source_sequence===selection.source_sequence);
   for(const [i,o] of source.options.entries())if(o.correct){await sp.getByRole(source.type==="multiple_mcq"?"checkbox":"radio").nth(i).click();await sp.locator('input[name="answer"]:checked').waitFor();}
   if(index===0){const before=activePayload.id;await sp.reload();await sp.getByRole("button",{name:"Submit test",exact:true}).waitFor();check(`Student ${width}: refresh resumes same attempt and persisted answer`,activePayload.id===before&&await sp.locator('input[name="answer"]:checked').count()>0);}
   if((selection.subhead===2&&selection.source_sequence===126)||(selection.subhead===4&&selection.source_sequence===68)){
    check(`Student ${width}: PATHO ${selection.subhead} Q${selection.source_sequence} superscript options render`,await sp.locator("sup").count()>=4);
    await sp.screenshot({path:`.local-qa/pathology-student-${width}-${selection.subhead}.png`});
   }
   await overflow(sp,`Student ${width}: question ${index+1} fits`);
   check(`Student ${width}: question ${index+1} solution images hidden`,await sp.locator('img[alt^="Solution image"]').count()===0);
   if(index<qa.selections.length-1)await sp.getByRole("button",{name:"Next",exact:true}).click();
  }
  await sp.getByRole("button",{name:"Submit test",exact:true}).click();await sp.getByRole("heading",{name:"Submitted result",exact:true}).waitFor();
  const expectedScore=qa.selections.reduce((n,s)=>n+input.find(q=>q.subhead===s.subhead&&q.source_sequence===s.source_sequence).marks,0);
  check(`Student ${width}: server score matches source keys`,(await sp.locator("body").innerText()).includes(`Score: ${expectedScore} / ${expectedScore}`));
  await sp.locator('img[alt^="Solution image"]').nth(3).waitFor({state:"attached"}); for(const img of await sp.locator('img[alt^="Solution image"]').all()) await img.scrollIntoViewIfNeeded();
  await sp.waitForFunction(()=>document.querySelectorAll('img[alt^="Solution image"]').length===4&&[...document.querySelectorAll('img[alt^="Solution image"]')].every(i=>i.complete&&i.naturalWidth>0));
  const paths=await sp.locator('img[alt^="Solution image"]').evaluateAll(imgs=>imgs.map(i=>decodeURIComponent(new URL(i.src).pathname)));
  const expectedPaths=qa.selections.flatMap(s=>manifest.images.filter(m=>m.question_id===s.question_id).sort((a,b)=>a.position-b.position).map(m=>m.storage_path));
  check(`Student ${width}: all four active solution images render in source order`,paths.every((p,i)=>p.endsWith(expectedPaths[i])));
  check(`Student ${width}: superscript review persists`,await sp.locator("sup").count()>=5);
  await overflow(sp,`Student ${width}: result/review fits`);await sp.screenshot({path:`.local-qa/pathology-review-${width}.png`});
  await sp.reload();await sp.getByRole("button",{name:"View result",exact:true}).first().click();await sp.getByRole("heading",{name:"Submitted result",exact:true}).waitFor();
  check(`Student ${width}: score and history survive reload`,(await sp.locator("body").innerText()).includes(`Score: ${expectedScore} / ${expectedScore}`));
  await learner.context.close();
 }
 check("No browser console/runtime errors",errors.length===0);
 writeFileSync("docs/pathology-browser-verification.json",JSON.stringify({results,errors,attempt_ids:attemptIds,viewports:[{width:1440,height:1000},{width:390,height:844}]},null,2));
}finally{await browser.close();}
