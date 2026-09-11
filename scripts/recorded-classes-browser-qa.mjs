import assert from "node:assert/strict";
import fs from "node:fs";
import {pathToFileURL} from "node:url";
// Uses the bundled browser runtime; no application dependency is added.
const entry=process.env.PLAYWRIGHT_ENTRY || "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const {chromium}=await import(pathToFileURL(entry));
const {expect}=await import(pathToFileURL(entry.replace(/index\.mjs$/, "test.mjs")));
const browser=process.env.RECORDED_QA_CDP ? await chromium.connectOverCDP(process.env.RECORDED_QA_CDP) : await chromium.launch({channel:"chrome",headless:true});
const context=await browser.newContext();
const page=await context.newPage();
page.setDefaultNavigationTimeout(60000);
const base="http://localhost:3012";
const imported=JSON.parse(fs.readFileSync(".local-qa/recorded-classes-import.json","utf8"));
const checks=[],videos=[],screenshots=[],performance=[];
function pass(s){checks.push(s);console.log("PASS "+s);}
async function screenshot(name){const path=`.local-qa/recorded-${name}.png`;await page.screenshot({path,fullPage:true});screenshots.push(path);}
async function noOverflow(label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),label);pass(label);}
async function adminList(){await page.goto(base+"/admin/recorded-classes");await expect(page.getByRole("heading",{name:"Hemostasis",exact:true})).toBeVisible();}
try {
 await context.addCookies(JSON.parse(fs.readFileSync(".local-qa/recorded-admin-state.json","utf8")).cookies);
 await page.setViewportSize({width:1440,height:1000});
 await adminList();
 await screenshot("admin-desktop");await noOverflow("Admin desktop 1440px has no overflow");
 const resources=await page.evaluate(()=>performance.getEntriesByType("resource").map(r=>({name:r.name,duration:r.duration})));
 assert.ok(!resources.some(r=>/rest\/v1\/(questions|question_options|question_answer_keys)/.test(r.name)));
 performance.push({page:"admin",resources:resources.filter(r=>r.name.includes("rest/v1")).map(r=>({url:r.name,duration_ms:Math.round(r.duration)}))});pass("No Admin Question Bank eager loading");
 for(const r of imported.filter(r=>r.videoId)){
  const row=page.locator("article").filter({has:page.getByRole("heading",{name:r.title,exact:true})});
  await row.getByRole("button",{name:"Preview",exact:true}).click();
  await page.waitForFunction(()=>{const i=document.querySelector('iframe');const p=i&&window.YT?.get?.(i.id);return p&&typeof p.getPlayerState==='function'&&typeof p.getPlayerState()==='number'},null,{timeout:25000});
  await page.evaluate(()=>{const p=window.YT.get(document.querySelector('iframe').id);p.mute();p.playVideo();});
  await page.waitForFunction(()=>{const p=window.YT?.get?.(document.querySelector('iframe')?.id);return p?.getPlayerState?.()===1&&p.getCurrentTime()>2},null,{timeout:35000});
  const evidence=await page.evaluate(()=>{const p=window.YT.get(document.querySelector('iframe').id);return {state:p.getPlayerState(),time:p.getCurrentTime(),duration:p.getDuration(),src:document.querySelector('iframe').src}});
  videos.push({id:r.videoId,...evidence,verified_at:new Date().toISOString()});
  await screenshot("playback-"+r.videoId);
  await page.evaluate(()=>window.YT.get(document.querySelector('iframe').id).pauseVideo());
  pass("Actual embedded playback "+r.videoId);
  await row.getByRole("button",{name:"Edit",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Edit recording"})).toBeVisible();
  await page.getByRole("combobox",{name:"Status",exact:true}).selectOption("published");
  await page.getByRole("button",{name:"Save recording",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Recording saved."})).toBeVisible();
  await expect(page.locator("article").filter({has:page.getByRole("heading",{name:r.title,exact:true})})).toContainText("published");
  pass("Admin publishes verified video "+r.title);
 }
 fs.writeFileSync(".local-qa/recorded-youtube-verification.json",JSON.stringify(videos,null,2));
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
 await screenshot("admin-mobile");await noOverflow("Admin mobile 390x844 has no overflow");
 await page.getByRole("button",{name:"Add recording",exact:true}).click();
 await page.getByRole("combobox",{name:"Subject *",exact:true}).selectOption(imported[0].subject_id);
 await page.getByRole("combobox",{name:"Topic *",exact:true}).selectOption(imported[0].chapter_id);
 await page.getByRole("combobox",{name:"Subject *",exact:true}).selectOption(imported[2].subject_id);
 assert.equal(await page.getByRole("combobox",{name:"Topic *",exact:true}).inputValue(),"");
 assert.ok(!(await page.getByRole("combobox",{name:"Topic *",exact:true}).innerText()).includes("BIO 1"));pass("Changing Subject resets and scopes Topics");
 await page.getByRole("combobox",{name:"Topic *",exact:true}).selectOption(imported[2].chapter_id);
 await page.getByLabel("Video title *",{exact:true}).fill("QA ONLY — Browser recording");
 await page.getByLabel("Sub-topic (optional)",{exact:true}).fill("Optional browser group");
 await expect(page.getByText("Video link pending — save as Draft until the link is available.",{exact:true})).toBeVisible();
 await screenshot("admin-form-mobile");await noOverflow("Admin form and URL field fit mobile");
 await page.getByRole("button",{name:"Save recording",exact:true}).click();
 await expect(page.getByRole("heading",{name:"QA ONLY — Browser recording",exact:true})).toBeVisible();pass("Admin creates link-pending Draft in browser");
 let row=page.locator("article").filter({has:page.getByRole("heading",{name:"QA ONLY — Browser recording",exact:true})});
 await row.getByRole("button",{name:"Edit",exact:true}).click();
 await page.getByRole("textbox",{name:/YouTube URL \/ Video ID/}).fill("https://example.com/wrong");
 await expect(page.getByRole("button",{name:"Save recording",exact:true})).toBeDisabled();pass("Malformed URL rejected in browser");
 await page.getByRole("textbox",{name:/YouTube URL \/ Video ID/}).fill("https://youtu.be/"+imported[2].videoId);
 await page.getByRole("button",{name:"Save recording",exact:true}).click();
 await expect(page.getByRole("heading",{name:"QA ONLY — Browser recording",exact:true})).toBeVisible();
 row=page.locator("article").filter({has:page.getByRole("heading",{name:"QA ONLY — Browser recording",exact:true})});
 await row.getByRole("button",{name:"Archive",exact:true}).click();
 await expect(row).toContainText("archived");pass("Admin edits and archives in browser");
 await page.getByRole("combobox",{name:"Status",exact:true}).selectOption("archived");
 await expect(page.locator("article")).toHaveCount(1);pass("Status filter works");
 await page.getByRole("combobox",{name:"Status",exact:true}).selectOption("");
 await page.getByRole("combobox",{name:"Subject",exact:true}).selectOption(imported[3].subject_id);
 await page.getByRole("combobox",{name:"Topic",exact:true}).selectOption(imported[3].chapter_id);
 await expect(page.locator("article")).toHaveCount(1);pass("Subject and Topic filters work");
 await page.getByLabel("Search",{exact:true}).fill("No such lesson");
 await expect(page.getByText("No recordings match these filters.",{exact:true})).toBeVisible();pass("Search and empty results work");
 await context.clearCookies();await context.addCookies(JSON.parse(fs.readFileSync(".local-qa/recorded-student-state.json","utf8")).cookies);
 const start=Date.now();await page.goto(base+"/student/recorded-classes");
 await expect(page.getByRole("link",{name:/Carbohydrates II/})).toBeVisible();
 performance.push({page:"student-mobile",navigation_to_content_ms:Date.now()-start});
 assert.ok(!(await page.locator('body').innerText()).includes("Hemostasis"));
 assert.ok(!(await page.content()).includes("studio.youtube.com"));pass("Student sees four published recordings, no Hemostasis or Studio data");
 await expect(page.getByRole("heading",{name:"CARBOHYDRATES",exact:true})).toBeVisible();pass("Optional sub-topic grouping shown");
 await noOverflow("Student library mobile has no overflow");await screenshot("student-mobile");
 await page.setViewportSize({width:1440,height:1000});await noOverflow("Student library desktop has no overflow");await screenshot("student-desktop");
 await page.setViewportSize({width:390,height:844});
 await page.getByRole("link",{name:/Trematodes I/}).click();
 await expect(page.getByRole("heading",{name:"Trematodes I",exact:true})).toBeVisible();
 await expect(page.locator('iframe')).toBeVisible();await noOverflow("Student player mobile has no overflow");await screenshot("student-player-mobile");
 await page.getByRole("link",{name:/Next recording/}).click();
 await expect(page.getByRole("heading",{name:"Influenza Parainfluenza Mumps RSV",exact:true})).toBeVisible();
 await page.getByRole("link",{name:/Previous recording/}).click();
 await expect(page.getByRole("heading",{name:"Trematodes I",exact:true})).toBeVisible();pass("Student Previous/Next stays within Subject and works");
 await page.setViewportSize({width:1440,height:1000});await noOverflow("Student player desktop has no overflow");await screenshot("student-player-desktop");
 await page.goto(base+"/student/recorded-classes/"+imported[1].id);
 await expect(page.getByRole("heading",{name:"Recording unavailable",exact:true})).toBeVisible();pass("Direct Draft URL denied");
 await page.goto(base+"/student/recorded-classes/deleted-recording");
 await expect(page.getByRole("heading",{name:"Recording unavailable",exact:true})).toBeVisible();pass("Deleted recording handled");
 await page.goto(base+"/student/courses",{waitUntil:"domcontentloaded"});await expect(page.getByRole("link",{name:/Recorded Classes/})).toBeVisible();pass("Courses entry reaches Recorded Classes");
} finally {
 fs.writeFileSync(".local-qa/recorded-browser-qa.json",JSON.stringify({checks,videos,screenshots,performance},null,2));
 await browser.close();
}
