import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from "node:url";
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const {expect}=await import(new URL("./test.mjs",pathToFileURL(process.env.PLAYWRIGHT_MODULE)).href);
const fixture=JSON.parse(fs.readFileSync('.local-qa/recorded-classes-auth.json'));
assert.ok(fixture.url.includes('xstssknlgdraulebdsfd'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();
const base='http://localhost:3018';
const result={initial:{},viewports:[]};
try {
await page.goto(base+'/login');
await page.getByRole('textbox',{name:'Email address',exact:true}).fill('recorded-classes-qa-student@example.invalid');
await page.getByRole('textbox',{name:'Password',exact:true}).fill(fixture.password);
await page.getByRole('button',{name:'Sign in',exact:true}).click();
await page.waitForURL('**/student');
let started=Date.now();
const response=await page.goto(base+'/student/courses');
await expect(page.getByRole('heading',{name:'Carbohydrates II',exact:true})).toBeVisible();
result.initial={usefulMs:Date.now()-started,htmlBytes:(await response.body()).length};
for(const width of [390,1440]){
 await page.setViewportSize({width,height:width===390?844:1000});
 await page.goto(base+"/student/courses");
 await page.waitForLoadState("networkidle");
 const events=[];
 const record=req=>events.push({url:req.url(),type:req.resourceType()});
 page.on('request',record);
 await page.evaluate(()=>{
  window.tabSamples=[];
  let start;
  document.querySelector('nav[aria-label="Course subjects"]').addEventListener('click',()=>{start=performance.now();},true);
  new MutationObserver(()=>{
   if(start===undefined)return;
   const active=document.querySelector('nav[aria-label="Course subjects"] a[aria-current]');
   const title=document.querySelector('#course-content + p')?.textContent;
   if(!active||!title||!active.textContent.startsWith(title))return;
   const ms=performance.now()-start;start=undefined;
   window.tabSamples.push({subject:title,commitMs:ms});
  }).observe(document.querySelector('main'),{childList:true,subtree:true,attributes:true});
 });
 for(const [subject,title] of [['Microbiology 2 recordings','Trematodes I'],['Pathology 1 recording','Donor selection'],['Biochemistry 1 recording','Carbohydrates II'],['Microbiology 2 recordings','Trematodes I'],['Biochemistry 1 recording','Carbohydrates II']]){
  await page.getByRole('link',{name:subject,exact:true}).click();
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 }
 await page.waitForTimeout(300);
 const samples=await page.evaluate(()=>window.tabSamples);
 assert.equal(samples.length,5);assert.ok(samples.every(s=>s.commitMs<200));
 console.log(JSON.stringify({width,samples,events}));
 assert.ok(!events.some(r=>(r.url.startsWith(base)&&!r.url.includes("favicon"))||r.url.includes('supabase.co')));
 assert.equal(await page.locator('main iframe').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`.local-qa/subject-switch-${width}.png`,fullPage:true});
 page.off('request',record);
 result.viewports.push({width,samples,requests:events});
}
console.log(JSON.stringify(result,null,2));
fs.writeFileSync('docs/course-subject-performance-browser.json',JSON.stringify(result,null,2));
} finally {await browser.close();}



