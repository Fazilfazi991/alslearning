// Starts only the dedicated local Compose project; never reads staging secrets.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
const project='als-registration-auth-qa', file='scripts/fixtures/registration-auth/compose.yml';
process.env.ALS_LOCAL_DB_PASSWORD=randomBytes(32).toString('hex');
process.env.ALS_LOCAL_JWT_SECRET=randomBytes(32).toString('hex');
const browser=process.env.ALS_LOCAL_BROWSER_QA==='1';
if(browser && (process.env.ALS_COMBINED_AUTH_QA!=='1' || process.env.VERCEL!==undefined)) throw new Error('Browser fixture requires an isolated combined local run');
if(process.env.ALS_COMBINED_AUTH_QA==='1') process.env.ALS_LOCAL_HOOK_ENABLED='true';
const docker=(args,options={})=>spawnSync('docker',args,{encoding:'utf8',...options});
const compose=(args)=>docker(['compose','-p',project,'-f',file,...(browser?['-f','scripts/fixtures/registration-auth/compose.browser.yml']:[]),...args],{stdio:'inherit'});
const existing=docker(['ps','-a','--filter',`name=^${project}-`,'--format','{{.Names}}']);
assert.equal(existing.status,0,'Docker unavailable');
assert.equal(existing.stdout.trim(),'','Dedicated QA containers already exist; inspect before retrying.');
try {
  assert.equal(compose(['up','-d','db','mail',...(browser?['template']:[])]).status,0,'Could not start database and mail');
  let ready=false;
  for(let i=0;i<60;i++){if(docker(['exec',`${project}-db-1`,'pg_isready','-h','127.0.0.1','-U','postgres','-d','gotrue']).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}
  assert.ok(ready,'Local database unavailable');
  assert.equal(docker(['exec',`${project}-db-1`,'psql','-U','postgres','-d','gotrue','-c','create schema auth']).status,0);
  assert.equal(compose(['up','-d','auth']).status,0,'Could not start Auth');
  ready=false;for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:19421/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
  assert.ok(ready,'Local Auth unavailable');
  if(browser){
    const health=await (await fetch('http://127.0.0.1:19421/health')).json();
    assert.equal(health.version,'v2.197.0','Unexpected local Auth version');
    const image=docker(['inspect','--format','{{.Image}}',`${project}-auth-1`]);
    assert.equal(image.stdout.trim(),'sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b','Unexpected local Auth image');
  }
  assert.equal(spawnSync(process.execPath,['scripts/registration-auth-integrated-qa.mjs'],{stdio:'inherit'}).status,0,'Integrated checks failed');
} finally { compose(['down']); }
