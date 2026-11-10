// Starts only the dedicated local Compose project; never reads staging secrets.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const project='als-registration-auth-qa', file='scripts/fixtures/registration-auth/compose.yml';
const docker=(args,options={})=>spawnSync('docker',args,{encoding:'utf8',...options});
const compose=(args)=>docker(['compose','-p',project,'-f',file,...args],{stdio:'inherit'});
const existing=docker(['ps','-a','--filter',`name=^${project}-`,'--format','{{.Names}}']);
assert.equal(existing.status,0,'Docker unavailable');
assert.equal(existing.stdout.trim(),'','Dedicated QA containers already exist; inspect before retrying.');
try {
  assert.equal(compose(['up','-d','db','mail']).status,0,'Could not start database and mail');
  let ready=false;
  for(let i=0;i<60;i++){if(docker(['exec',`${project}-db-1`,'pg_isready','-h','127.0.0.1','-U','postgres','-d','gotrue']).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}
  assert.ok(ready,'Local database unavailable');
  assert.equal(docker(['exec',`${project}-db-1`,'psql','-U','postgres','-d','gotrue','-c','create schema auth']).status,0);
  assert.equal(compose(['up','-d','auth']).status,0,'Could not start Auth');
  ready=false;for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:19421/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
  assert.ok(ready,'Local Auth unavailable');
  assert.equal(spawnSync(process.execPath,['scripts/registration-auth-integrated-qa.mjs'],{stdio:'inherit'}).status,0,'Integrated checks failed');
} finally { compose(['down']); }
