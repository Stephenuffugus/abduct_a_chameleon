/* Can a whole round actually happen, and does it hand back to free play?
 * The phase machine was rewired the day free play landed: a round no longer
 * auto-starts, and an intermission returns to 'waiting' instead of dealing the
 * next round. Nobody has ever played one through. This drives two real clients
 * from free play -> START -> roles -> hide window -> hunt -> end -> free play. */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer');
const GAME=path.resolve('../abduct-3d.html'); const ROOT=path.dirname(GAME);
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv=await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});
const base=`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
async function boot(url){
  const ctx=await b.createBrowserContext(); const p=await ctx.newPage();
  await p.setViewport({width:900,height:500,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  for(let i=0,d=false;i<40&&!d;i++){for(const f of p.frames()){try{if(await f.evaluate(()=>{const x=[...document.querySelectorAll('button,div')].find(e=>/^\s*launch\s*$/i.test(e.textContent||''));if(x){x.click();return true;}return false;})){d=true;break;}}catch{}} if(!d)await new Promise(r=>setTimeout(r,500));}
  await new Promise(r=>setTimeout(r,3000));
  for(const id of ['howtoGo','tapStart']){try{await p.evaluate(i=>{const e=document.getElementById(i);if(e&&getComputedStyle(e).display!=='none')e.click();},id);}catch{}}
  await new Promise(r=>setTimeout(r,4500));
  return {p,errs};
}
const A=await boot(base);
const room=await A.p.evaluate(()=>location.hash||'');
const B=await boot(base+room);
await new Promise(r=>setTimeout(r,2500));
const snap=async()=>({A:await A.p.evaluate(()=>window.__aac3dRound()), B:await B.p.evaluate(()=>window.__aac3dRound())});
const bad=[];
let s0=await snap();
console.log('1 free play   ', JSON.stringify({phase:s0.A.phase, roles:[s0.A.myRole,s0.B.myRole], players:s0.A.players}));
if(s0.A.phase!=='waiting') bad.push('two players did not land in free play');
if(s0.A.myRole==='seeker'||s0.B.myRole==='seeker') bad.push('somebody was put in a UFO without asking');

// press START on whichever client shows the button
for(const c of [A,B]) await c.p.evaluate(()=>{const e=document.getElementById('tStart'); if(e && !e.classList.contains('hidden')) e.click();});
await new Promise(r=>setTimeout(r,2500));
let s1=await snap();
console.log('2 round begins', JSON.stringify({phase:s1.A.phase, roles:[s1.A.myRole,s1.B.myRole], hideLeft:Math.round(s1.A.hideLeft)}));
if(s1.A.phase!=='playing') bad.push('START did not begin a round');
/* ⛔ this was written as `!(A) !== !(B)` and then pushed the failure when it
   was TRUE — an inverted XOR, so it flagged the CORRECT outcome. Exactly
   one seeker means the two booleans differ. */
if((s1.A.myRole==='seeker') === (s1.B.myRole==='seeker')) bad.push('a two player round did not make exactly one seeker');
if(s1.A.hideLeft<=0) bad.push('no hider head start in a real round');

// skip the head start: the seeker should now be loose
for(const c of [A,B]) await c.p.evaluate(()=>window.__aac3dRoundSkip('hide'));
await new Promise(r=>setTimeout(r,2000));
let s2=await snap();
console.log('3 hunt is on  ', JSON.stringify({phase:s2.A.phase, hideLeft:Math.round(s2.A.hideLeft), canBeCaught:[s2.A.canBeCaught,s2.B.canBeCaught]}));
if(s2.A.hideLeft>1) bad.push('the head start did not end');
if(!(s2.A.canBeCaught||s2.B.canBeCaught)) bad.push('nobody could be caught once the head start ended');

// run the clock out
for(const c of [A,B]) await c.p.evaluate(()=>window.__aac3dRoundSkip('round'));
await new Promise(r=>setTimeout(r,3000));
let s3=await snap();
console.log('4 round ends  ', JSON.stringify({phase:s3.A.phase}));
if(s3.A.phase!=='intermission') bad.push('the round did not end when its clock ran out (phase '+s3.A.phase+')');

// and hand back to free play, not straight into another round
for(const c of [A,B]) await c.p.evaluate(()=>window.__aac3dRoundSkip('inter'));
await new Promise(r=>setTimeout(r,3000));
let s4=await snap();
console.log('5 back to free', JSON.stringify({phase:s4.A.phase, roles:[s4.A.myRole,s4.B.myRole], caught:[s4.A.abducted,s4.B.abducted]}));
if(s4.A.phase!=='waiting') bad.push('intermission did not hand back to free play');
if(s4.A.myRole==='seeker'||s4.B.myRole==='seeker') bad.push('somebody is still flying a saucer around the lobby');
if(s4.A.abducted||s4.B.abducted) bad.push('somebody is still marked abducted in free play');

const errs=[...A.errs,...B.errs];
if(errs.length) bad.push('JS errors: '+errs.slice(0,2).join(' | '));
console.log(bad.length ? '\nFAIL roundtrip:\n  - '+bad.join('\n  - ')
                       : '\nok   roundtrip: free play -> START -> one seeker -> head start -> hunt -> end -> free play');
await b.close(); srv.close();
process.exit(bad.length?1:0);
