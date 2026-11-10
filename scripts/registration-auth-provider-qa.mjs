import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:19421';
const jwtPart=(v)=>Buffer.from(JSON.stringify(v)).toString('base64url');
const payload=jwtPart({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600});
const prefix=`${jwtPart({alg:'HS256',typ:'JWT'})}.${payload}`;
const token=`${prefix}.${createHmac('sha256','this-is-a-disposable-local-only-registration-secret-123456').update(prefix).digest('base64url')}`;
async function api(path,body,bearer=token){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${bearer}`},body:JSON.stringify(body)});const data=await r.json();return {status:r.status,data};}
const email=`student-${Date.now()}@example.test`;
const created=await api('/admin/users',{email,email_confirm:false,app_metadata:{role:'student',lms_admission:{registration_id:'test-registration'}},user_metadata:{full_name:'Local Test Student'}});
assert.equal(created.status,200,JSON.stringify(created.data));
const id=created.data.id;assert.ok(id);assert.equal(created.data.email_confirmed_at,undefined);
const invite=await api('/invite?redirect_to=http%3A%2F%2F127.0.0.1%3A19422%2Fauth%2Fcallback',{email});
assert.equal(invite.status,200,JSON.stringify(invite.data));assert.equal(invite.data.id,id);
let message;for(let i=0;i<20;i++){const r=await fetch('http://127.0.0.1:19425/api/v1/messages');const m=await r.json();message=m.messages?.[0];if(message)break;await new Promise(r=>setTimeout(r,500));}
assert.ok(message,'mail not received');
const detail=await (await fetch(`http://127.0.0.1:19425/api/v1/message/${message.ID}`)).json();
const link=(detail.Text || detail.HTML || '').match(/https?:\/\/[^\s"<>]+\/verify\?[^\s"<>]+/);
assert.ok(link,'invite link missing');const action=new URL(link[0].replaceAll('&amp;','&'));const hash=action.searchParams.get('token');assert.ok(hash);assert.equal(action.searchParams.get('type'),'invite');
const verified=await api('/verify',{token_hash:hash,type:'invite'});assert.equal(verified.status,200,JSON.stringify(verified.data));assert.equal(verified.data.user.id,id);assert.ok(verified.data.user.email_confirmed_at);assert.ok(verified.data.access_token);
const password='Local-Password-123!';const updated=await fetch(base+'/user',{method:'PUT',headers:{Authorization:`Bearer ${verified.data.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(updated.status,200,await updated.text());
const login=await api('/token?grant_type=password',{email,password},'');assert.equal(login.status,200,JSON.stringify(login.data));assert.equal(login.data.user.id,id);
const again=await api('/invite',{email});assert.notEqual(again.status,200);
console.log(JSON.stringify({createdUnconfirmed:true,inviteReusedSameIdentity:true,mailReceived:true,inviteTokenVerified:true,emailConfirmedByToken:true,passwordSet:true,passwordLogin:true,confirmedReinviteRejected:true}));
