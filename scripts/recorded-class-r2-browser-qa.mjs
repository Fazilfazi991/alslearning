import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "../.local-qa/playwright/node_modules/playwright/index.mjs";

const fixture=JSON.parse(fs.readFileSync(".local-qa/recorded-classes-auth.json","utf8"));
const base=process.env.QA_APP_URL||"http://localhost:3007";
const recordingId="573ecbcc-05d7-4212-8b50-fbdb7463af37";
const browser=await chromium.launch({channel:"chrome",headless:true,args:["--autoplay-policy=no-user-gesture-required"]});
const result={base,viewports:[],security:{},playback:{}};
if(process.env.SUPABASE_ACCESS_TOKEN){
  const reset=await fetch("https://api.supabase.com/v1/projects/xstssknlgdraulebdsfd/database/query",{method:"POST",headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({query:`delete from public.recorded_class_responses where recorded_class_id='${recordingId}' and student_id=(select id from public.profiles where email='recorded-classes-qa-student@example.invalid'); delete from public.recorded_class_progress where recorded_class_id='${recordingId}' and student_id=(select id from public.profiles where email='recorded-classes-qa-student@example.invalid');`})});
  assert.equal(reset.ok,true,"Could not reset disposable QA playback state");
}
async function login(page){await page.goto(`${base}/login`);await page.getByRole("textbox",{name:"Email address",exact:true}).fill("recorded-classes-qa-student@example.invalid");await page.getByRole("textbox",{name:"Password",exact:true}).fill(fixture.password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await page.waitForURL("**/student");}
try{
  const anonymous=await browser.newContext(); const anonymousPage=await anonymous.newPage();
  const anonymousResponse=await anonymousPage.request.get(`${base}/api/recorded-classes/${recordingId}/playback`);
  assert.equal(anonymousResponse.status(),401); result.security.anonymous=401; await anonymous.close();
  for(const [viewportIndex,viewport] of [{width:390,height:844},{width:1440,height:1000}].entries()){
    const context=await browser.newContext({viewport}); const page=await context.newPage(); await login(page);
    const playbackPromise=page.waitForResponse(response=>response.url().includes(`/api/recorded-classes/${recordingId}/playback`)&&response.ok());
    await page.goto(`${base}/student/recorded-classes/${recordingId}`);
    await page.getByRole("heading",{name:"Carbohydrates II",exact:true}).waitFor();
    const playbackResponse=await playbackPromise;
    const payload=await playbackResponse.json(); assert.match(payload.playbackUrl,/r2\.cloudflarestorage\.com/); assert.equal(payload.interactions.length,3);
    const video=page.locator("video"); await video.waitFor(); await page.waitForFunction(()=>{const v=document.querySelector("video");return v&&v.readyState>=1&&v.duration>6700;});
    const metadata=await video.evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,controls:v.controls,playsInline:v.playsInline,poster:!!v.poster}));
    assert.ok(metadata.duration>6725&&metadata.duration<6726); assert.equal(metadata.width,1920); assert.equal(metadata.height,1080); assert.equal(metadata.controls,true); assert.equal(metadata.playsInline,true); assert.equal(metadata.poster,true);
    if(viewportIndex===0){
      await video.evaluate(v=>{v.currentTime=40;}); await page.getByText("Quick Check",{exact:true}).waitFor();
      await page.getByText("QA option A",{exact:true}).click(); await page.getByRole("button",{name:"Submit answer",exact:true}).click(); await page.getByText("Correct",{exact:true}).waitFor(); await page.getByRole("button",{name:"Continue class",exact:true}).click();
      await video.evaluate(v=>{v.currentTime=90;}); await page.getByText("Quick Check",{exact:true}).waitFor();
      await page.getByText("Verified",{exact:true}).click(); await page.getByRole("button",{name:"Submit answer",exact:true}).click(); await page.getByText("Correct",{exact:true}).waitFor(); await page.getByRole("button",{name:"Continue class",exact:true}).click();
      await video.evaluate(async v=>{await new Promise(resolve=>{v.addEventListener("seeked",resolve,{once:true});v.currentTime=119;});await v.play();}); await page.getByText("Quick Check",{exact:true}).waitFor();
      await page.screenshot({path:".local-qa/r2/native-player-quick-check-390.png",fullPage:true});
      await page.getByText("Continue",{exact:true}).click(); await page.getByRole("button",{name:"Submit answer",exact:true}).click(); await page.getByText("Correct",{exact:true}).waitFor(); await page.getByRole("button",{name:"Continue class",exact:true}).click();
    }else{
      await video.evaluate(v=>{v.currentTime=90;}); await page.waitForTimeout(300); assert.equal(await page.getByText("Quick Check",{exact:true}).count(),0);
    }
    await video.evaluate(v=>{v.currentTime=v.duration*0.96;v.pause();}); await page.waitForTimeout(800); await page.reload();
    await page.waitForFunction(()=>{const v=document.querySelector("video");return v&&v.readyState>=1;});
    const resume=await video.evaluate(v=>v.currentTime); assert.ok(resume>6400); await page.getByText("Complete",{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`.local-qa/r2/native-player-${viewport.width}.png`,fullPage:true});
    result.viewports.push({...viewport,metadata,resume,quickChecks:viewportIndex===0?3:0,optionalPlaybackCheck:viewportIndex===0,completedInteractionsDoNotRepeat:viewportIndex===1,overflow:false});
    await context.clearCookies(); await login(page); await page.goto(`${base}/student/recorded-classes/${recordingId}`); await page.waitForFunction(()=>document.querySelector("video")?.readyState>=1);
    const reloginResume=await page.locator("video").evaluate(v=>v.currentTime); assert.ok(reloginResume>6400); result.playback.reloginResume=reloginResume;
    await context.close();
  }
  result.security.authorizedStudent="temporary R2 URL issued"; result.playback.rangeSeeking=true; result.playback.requiredSeekCrossing=true; result.playback.optionalNormalPlayback=true; result.playback.progressPersisted=true; result.playback.completedAtPersisted=true;
  fs.writeFileSync(".local-qa/r2/browser-qa.json",JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
