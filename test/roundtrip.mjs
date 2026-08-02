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

/* ⭐ 2026-08-02: A ROUND NOW ANNOUNCES ITSELF, AND THAT IS PART OF THE CONTRACT.
   Stephen's wife pressed START, waited two minutes and could not tell whether
   anything had happened - the press wrote a silent boolean and the only visible
   consequence was the phase flipping, whenever the host got round to it. There
   is a three second 'starting' phase between the ask and the round now, and
   BOTH clients have to see it: a countdown only one person can see is the same
   bug in a nicer coat. Then poll to 'playing' rather than sleeping past it. */
let sawGo = { A:false, B:false };
for(let t=0; t<40; t++){
  const g = await snap();
  if(g.A.phase==='starting') sawGo.A = true;
  if(g.B.phase==='starting') sawGo.B = true;
  if(g.A.phase==='playing' && g.B.phase==='playing') break;
  await new Promise(r=>setTimeout(r,150));
}
console.log('1b countdown  ', JSON.stringify(sawGo));
if(!sawGo.A || !sawGo.B) bad.push('the START countdown was not visible to both players');
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

/* ⛔⛔ 6. THE GUEST'S PRESS HAS TO WORK, AND NOTHING HAS EVER PROVEN IT DOES.
   `startReq` is the ONLY global state key written by somebody other than the
   host - every other one goes through hostTick, startRound, endRound or a
   `if(!isHost()) return` guard. Whether playroomkit relays a guest's global
   write and lets it survive the host's reconciliation is not knowable from this
   repo (playroomkit is a CDN import, there is no copy on disk). If it does not,
   then a guest pressing START is a permanent silent no-op - and START ROUND is
   shown to BOTH players, so half the room would be pressing a dead button while
   the game says nothing. That is a precise description of what Stephen's wife
   sat through, and the step above cannot catch it because it presses on both.
   So: press it on the GUEST alone, from a clean free-play state, and require the
   room to move. */
const HOST_C  = (await A.p.evaluate(()=>window.__aac3dRound().host)) ? A : B;
const GUEST_C = HOST_C === A ? B : A;
await GUEST_C.p.evaluate(()=>{const e=document.getElementById('tStart');
  if(e && !e.classList.contains('hidden')) e.click();});
let guestMoved = false, guestPhase = 'waiting';
for(let t=0;t<40;t++){
  guestPhase = await HOST_C.p.evaluate(()=>window.__aac3dRound().phase);
  if(guestPhase !== 'waiting'){ guestMoved = true; break; }
  await new Promise(r=>setTimeout(r,150));
}
console.log('6 guest starts', JSON.stringify({moved:guestMoved, phase:guestPhase}));
if(!guestMoved) bad.push('a GUEST pressing START ROUND did nothing - only the host can start a round, and nothing on screen says so');

/* ⛔⛔ 7. AND SOMEBODY HAS TO GET CAUGHT. This gate drove a whole round end to end
   and never once had anybody taken, so it could not see that the seekers were
   unable to win AT ALL: hostTick counted a hider as out of the round only when
   `abducted` was set, the 8/02 rework moved the real catch onto `held`, and the
   only remaining writer of `abducted` is a test hook. Every round ended on the
   clock with "the hiders survived", however many people the hunter had caught.
   Start a round, catch the hider, and require the room to end it for the seekers. */
{
  for(let t=0;t<40;t++){
    for(const c of [A,B]) await c.p.evaluate(()=>{const e=document.getElementById('tStart'); if(e&&!e.classList.contains('hidden')) e.click();});
    const ph = await A.p.evaluate(()=>window.__aac3dRound().phase);
    if(ph==='playing'||ph==='hiding') break;
    await new Promise(r=>setTimeout(r,150));
  }
  for(const c of [A,B]) await c.p.evaluate(()=>{ try{ window.__aac3dRoundSkip('hide'); }catch(_){} });
  await new Promise(r=>setTimeout(r,600));
  const roles = [];
  for(const c of [A,B]) roles.push(await c.p.evaluate(()=>window.__aac3dRound().myRole));
  const HID = roles[0]==='hider' ? A : B;
  const SEK = HID === A ? B : A;
  /* ⛔⛔ A REAL CATCH, NOT THE HOOK. The first version of this step called
     __aac3dCatchMe, which writes `abducted` - the LEGACY flag, and the very one the bug
     was about. Re-pointed at the broken predicate it still reported winner=seekers, so
     it proved nothing: I had written the exact test theatre I spent the day deleting.
     Park the saucer on the hider and hold the beam, and the round has to end the way a
     round actually ends - through `held`. */
  const hp = await HID.p.evaluate(()=>{ const r=window.__aac3dPlayer? window.__aac3dPlayer():null;
    return r ? {x:r.x, z:r.z} : {x:0, z:0}; });
  await SEK.p.evaluate(p=>{ window.__aac3dPlace(p.x, 12, p.z, 0); }, hp);
  await new Promise(r=>setTimeout(r,400));
  await SEK.p.evaluate(()=>{ window.__aac3dBeam(true); });
  let held=false;
  for(let t=0;t<50 && !held;t++){
    await SEK.p.evaluate(p=>{ window.__aac3dPlace(p.x, 12, p.z, 0); window.__aac3dBeam(true); }, hp);
    held = await HID.p.evaluate(()=>window.__aac3dRound().held);
    if(!held) await new Promise(r=>setTimeout(r,200));
  }
  console.log('   real catch', JSON.stringify({held}));
  if(!held) bad.push('parking a saucer on a hider and holding the beam never caught them');
  let winner=null, phase=null;
  for(let t=0;t<60;t++){
    const r = await A.p.evaluate(()=>window.__aac3dRound());
    winner = r.winner; phase = r.phase;
    if(winner) break;
    await new Promise(r2=>setTimeout(r2,200));
  }
  console.log('7 caught ends it', JSON.stringify({roles, winner, phase}));
  if(!roles.includes('seeker')) console.log('   (no seeker in this room - step skipped)');
  else if(!held) console.log('   (never got a catch - the end-of-round claim below is unproven)');
  else if(winner !== 'seekers')
    bad.push(`catching every hider did not end the round for the seekers (winner=${winner}) - the hunt cannot be won, only survived`);
}

const errs=[...A.errs,...B.errs];
if(errs.length) bad.push('JS errors: '+errs.slice(0,2).join(' | '));
console.log(bad.length ? '\nFAIL roundtrip:\n  - '+bad.join('\n  - ')
                       : '\nok   roundtrip: free play -> START -> one seeker -> head start -> hunt -> end -> free play, and a guest can start one too');
await b.close(); srv.close();
process.exit(bad.length?1:0);
