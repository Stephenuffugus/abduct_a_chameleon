/* TWO PEOPLE JOINED AND THE GAME LIED TO THEM.
 *
 *   cd test && node lobby3d.mjs [../abduct-3d.html]
 *
 * Stephen and Jessie, first two-player session:
 *   "we were both on the same team with an alien hunting us. i thought wed be on
 *    opposite teams so one of us hunts and the other hides. its sayign we only
 *    have 22 seconds to hide. thats wrong."
 *
 * Every word of that was the lobby's fault, and none of it was a rules problem:
 *   - The solo TRAINING BOT runs whenever phase !== 'playing', so a two-player
 *     lobby spawned an alien that hunted them and could not catch anybody.
 *   - The free-play banner read "nothing can catch you for 38s", which is the
 *     BOT'S GRACE TIMER wearing the hide clock's clothes. That is the "22
 *     seconds", and it counts down to nothing happening.
 *   - START ROUND exists but two adults never found it, so they never played a
 *     real round at all.
 *
 * The rules this holds:
 *   1. NO BOT WITH A SECOND REAL PLAYER IN THE ROOM.
 *   2. NO COUNTDOWN IN FREE PLAY. A number ticking down means something is about
 *      to happen; nothing is.
 *   3. START ROUND IS UNMISSABLE - on screen, at least 44px, and it says what it
 *      will do.
 *   4. PRESSING IT MAKES EXACTLY ONE HUNTER, which is what they expected.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
let puppeteer;
try { puppeteer = require_('/workspaces/lucid-winds/node_modules/puppeteer'); }
catch { console.log('lobby3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, process.argv[2] || '../abduct-3d.html');
const ROOT = path.dirname(GAME);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});
const base = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
async function boot(url){
  const ctx=await b.createBrowserContext(); const p=await ctx.newPage();
  await p.setViewport({width:812,height:375,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  for(let i=0,d=false;i<40&&!d;i++){for(const f of p.frames()){try{if(await f.evaluate(()=>{const x=[...document.querySelectorAll('button,div')].find(e=>/^\s*launch\s*$/i.test(e.textContent||''));if(x){x.click();return true;}return false;})){d=true;break;}}catch{}} if(!d)await new Promise(r=>setTimeout(r,500));}
  await new Promise(r=>setTimeout(r,3000));
  for(const id of ['howtoGo','tapStart']){try{await p.evaluate(i=>{const e=document.getElementById(i);if(e&&getComputedStyle(e).display!=='none')e.click();},id);}catch{}}
  await new Promise(r=>setTimeout(r,5000));
  return {p,errs};
}
const wait = ms => new Promise(r=>setTimeout(r,ms));
const bad = [];

const A = await boot(base);
const room = await A.p.evaluate(()=>location.hash||'');
const B = await boot(base+room);
/* poll until BOTH clients agree there are two of them - a flat sleep here is the
   timing assumption that has bitten every gate in this suite */
let seen = 0;
for(let t=0;t<40 && seen<2;t++){ await wait(500);
  seen = Math.min(await A.p.evaluate(()=>window.__aac3dRound().players),
                  await B.p.evaluate(()=>window.__aac3dRound().players)); }
if(seen < 2){ console.log('FAIL lobby3d\n   - the two clients never saw each other'); await b.close(); srv.close(); process.exit(1); }

// 1+2. what a second person walks into
const lobby = await A.p.evaluate(()=>{
  const r = window.__aac3dRound();
  const vis = el => { if(!el) return false; const s=getComputedStyle(el);
    return s.display!=='none' && s.visibility!=='hidden' && +s.opacity>0.05; };
  /* A countdown IN THE BANNER is the lie - that is the thing a player reads as
     "how long until something happens". Career stats elsewhere may legitimately
     carry a number of seconds; scoping to the banner keeps this honest. */
  const ticking = [];
  for(const id of ['bannerTitle','bannerSub','banner']){
    const el = document.getElementById(id); if(!el || !vis(el)) continue;
    const own = id==='banner' ? '' : (el.textContent||'');
    if(/\b\d+\s*s\b|\b\d+\s*seconds?\b|\bfor\s+\d+\b/i.test(own)) ticking.push(id+': '+own.trim().slice(0,70));
  }
  const st = document.getElementById('tStart');
  const sb = st ? st.getBoundingClientRect() : null;
  return { phase:r.phase, players:r.players, roles:r.myRole, botExists:r.botExists,
           soloGrace:r.soloGrace, ticking,
           start: st ? { vis:vis(st), w:Math.round(sb.width), h:Math.round(sb.height),
                         onScreen: sb.left>=0 && sb.top>=0 && sb.right<=innerWidth && sb.bottom<=innerHeight,
                         text:(st.textContent||'').trim() } : null };
});
console.log('1 two in a room', JSON.stringify(lobby));
if(lobby.botExists)     bad.push('a training bot is hunting a room that has two real players in it');
if(lobby.ticking.length) bad.push(`free play shows a countdown, which promises something that never happens: ${lobby.ticking.join(' | ')}`);
if(!lobby.start)        bad.push('there is no START ROUND button at all');
else {
  if(!lobby.start.vis)      bad.push('START ROUND is not visible with two players waiting');
  if(!lobby.start.onScreen) bad.push('START ROUND is off screen');
  if(lobby.start.h < 44)    bad.push(`START ROUND is ${lobby.start.h}px tall, under the 44px floor`);
  if(!/start/i.test(lobby.start.text)) bad.push(`START ROUND does not say what it does ("${lobby.start.text}")`);
}

/* 5. YOU PICK YOUR SIDE, AND THE HOST OWNS THE CLOCK.
   Stephen: "when two players go to play together they should be able to choose
   which team they are on... at least like 2 minutes to hide... and the game host
   can set it and it has to be at least 1 minutes or something and no more than 5." */
const lobUp = await Promise.all([A,B].map(c => c.p.evaluate(()=>{
  const l = document.getElementById('lobby');
  const r = id => { const e=document.getElementById(id); const b=e.getBoundingClientRect();
    return { h:Math.round(b.height), on:e.classList.contains('on') }; };
  return { vis: l && !l.classList.contains('hidden'),
           hide:r('tTeamHide'), seek:r('tTeamSeek'),
           time: document.getElementById('lobTimeVal').textContent,
           room: (document.getElementById('lobRoom')||{}).textContent || '',
           copy: (()=>{ const e=document.getElementById('tCopyLink'); if(!e) return null;
                        const b=e.getBoundingClientRect(); return {h:Math.round(b.height)}; })(),
           who: document.getElementById('lobWho').textContent,
           duplicateHunt: !document.getElementById('tPractice').classList.contains('hidden') };
})));
console.log('3 the lobby   ', JSON.stringify(lobUp[0]));
if(!lobUp[0].vis || !lobUp[1].vis) bad.push('the lobby is not shown to both players');
if(lobUp[0].hide.h < 44 || lobUp[0].seek.h < 44) bad.push('the team buttons are under 44px');
if(lobUp[0].time !== '2:00') bad.push(`the hide clock does not default to two minutes (${lobUp[0].time})`);
if(!/chosen|random/i.test(lobUp[0].who)) bad.push('with nobody picked, the lobby does not say one will be chosen');
/* ⛔⛔ THE TWO FACTS THAT COST A WHOLE TEST SESSION. If two devices are not in the
   same room each one sees a perfectly normal game that simply never starts, and
   nothing on screen says so. The lobby must show WHICH room you are in, HOW MANY
   are in it, and give you a link to hand over. */
if(!/^ROOM [A-Za-z0-9_-]+$/.test(lobUp[0].room)) bad.push(`the lobby does not show a room code ("${lobUp[0].room}")`);
if(!/2 players/.test(lobUp[0].who)) bad.push(`the lobby does not say how many are in the room ("${lobUp[0].who}")`);
if(!lobUp[0].copy || lobUp[0].copy.h < 44) bad.push('there is no 44px COPY LINK button to invite anybody with');
if(lobUp[0].duplicateHunt) bad.push('the solo HUNT button is still up beside the SEEK button - two controls labelled hunt');

// A asks to seek, B asks to hide
await A.p.evaluate(()=>document.getElementById('tTeamSeek').click());
await B.p.evaluate(()=>document.getElementById('tTeamHide').click());
/* ⛔ ASSERT THE VALUE, NOT THE LABEL. lobTimeVal is painted by updateHUD once a
   frame, so reading it in the same tick as a click is always one frame stale -
   an earlier version of this reported "the clock will not move" while the state
   underneath was stepping 150, 180, 210 perfectly, then passed on a re-run. A
   gate that flakes teaches you to distrust the green. Drive the HOST only, space
   the taps, and check the number the round will actually use. */
const HOST = (await A.p.evaluate(()=>window.__aac3dRound().host)) ? A : B;
const GUEST = HOST === A ? B : A;
const wind = async (id, times) => {
  for(let i=0;i<times;i++){
    await HOST.p.evaluate(bid=>document.getElementById(bid).click(), id);
    await wait(70);
  }
  await wait(1000);
  return HOST.p.evaluate(()=>({ secs: window.__aac3dRound().hideSecs,
                                text: document.getElementById('lobTimeVal').textContent }));
};
const floor_ = await wind('tTimeDown', 12);
console.log('4 clock floor ', JSON.stringify(floor_));
if(floor_.secs !== 60)     bad.push(`winding down did not stop at the one minute floor (${floor_.secs}s)`);
if(floor_.text !== '1:00') bad.push(`the clock reads "${floor_.text}" while it is really ${floor_.secs}s`);
const ceil_ = await wind('tTimeUp', 14);
console.log('5 clock ceil  ', JSON.stringify(ceil_));
if(ceil_.secs !== 300)     bad.push(`winding up did not stop at the five minute ceiling (${ceil_.secs}s)`);
if(ceil_.text !== '5:00')  bad.push(`the clock reads "${ceil_.text}" while it is really ${ceil_.secs}s`);
/* somebody has to own the clock, or two people fight over one number on the wire */
const beforeGuest = ceil_.secs;
for(let i=0;i<4;i++){ await GUEST.p.evaluate(()=>document.getElementById('tTimeDown').click()); await wait(70); }
await wait(900);
const afterGuest = await HOST.p.evaluate(()=>window.__aac3dRound().hideSecs);
console.log('5b guest tries', JSON.stringify({ beforeGuest, afterGuest }));
if(afterGuest !== beforeGuest) bad.push(`a non-host moved the clock (${beforeGuest} -> ${afterGuest})`);
const back = await wind('tTimeDown', 12);
if(back.secs !== 60) bad.push(`could not put the clock back to one minute (${back.secs}s)`);

// 4. and pressing it does the thing they expected
for(const c of [A,B]) await c.p.evaluate(()=>{const e=document.getElementById('tStart'); if(e && !e.classList.contains('hidden')) e.click();});
let roles = [];
for(let t=0;t<30;t++){ await wait(500);
  roles = [await A.p.evaluate(()=>window.__aac3dRound().myRole),
           await B.p.evaluate(()=>window.__aac3dRound().myRole)];
  if(roles.includes('seeker')) break; }
const after = await A.p.evaluate(()=>window.__aac3dRound());
console.log('2 they press it', JSON.stringify({roles, phase:after.phase, bot:after.botExists}));
if((roles[0]==='seeker') === (roles[1]==='seeker'))
  bad.push(`pressing START did not put exactly one of them in a UFO (${roles.join(' / ')})`);
if(after.phase !== 'playing') bad.push(`pressing START did not begin a round (phase ${after.phase})`);
if(after.botExists) bad.push('the training bot is still running inside a real round');

// the person who asked to SEEK is the one in the saucer, and the clock is theirs
const picked = { A: await A.p.evaluate(()=>window.__aac3dRound()),
                 B: await B.p.evaluate(()=>window.__aac3dRound()) };
console.log('6 sides kept  ', JSON.stringify({ A:picked.A.myRole, B:picked.B.myRole,
  hideLeft: Math.round(picked.A.hideLeft) }));
if(picked.A.myRole !== 'seeker') bad.push(`the player who asked to SEEK was made a ${picked.A.myRole}`);
if(picked.B.myRole !== 'hider')  bad.push(`the player who asked to HIDE was made a ${picked.B.myRole}`);
/* ⛔ assert the round's CONFIGURED length, not what is left of it - the poll that
   waits for roles to sync can eat 40 of the 60 seconds before this line runs, and
   a gate that fails because the gate was slow teaches you to distrust the green */
if(picked.A.hideSecs !== 60)
  bad.push(`the round ignored the chosen hide time (ran ${picked.A.hideSecs}s, chose 60)`);
if(picked.A.hideLeft <= 0) bad.push('the hiders got no head start at all');

const errs = [...A.errs, ...B.errs];
if(errs.length) bad.push('JS errors: ' + errs.slice(0,2).join(' | '));
console.log(bad.length ? '\nFAIL lobby3d:\n  - ' + bad.join('\n  - ')
  : '\nok   lobby3d  free play with no bot and no countdown, both see the lobby, the clock holds 1-5 minutes, ' +
    'picking SEEK puts you in the saucer and picking HIDE keeps you on the ground, and the round runs the clock they chose');
await b.close(); srv.close();
process.exit(bad.length ? 1 : 0);
