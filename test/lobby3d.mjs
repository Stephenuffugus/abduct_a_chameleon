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

const errs = [...A.errs, ...B.errs];
if(errs.length) bad.push('JS errors: ' + errs.slice(0,2).join(' | '));
console.log(bad.length ? '\nFAIL lobby3d:\n  - ' + bad.join('\n  - ')
  : '\nok   lobby3d  two people land in free play with no bot and no countdown, START ROUND is unmissable, and pressing it makes exactly one hunter');
await b.close(); srv.close();
process.exit(bad.length ? 1 : 0);
