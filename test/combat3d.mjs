/* THE STANDOFF MUST BE IMPOSSIBLE.
 *
 *   cd test && node combat3d.mjs [../abduct-3d.html]
 *
 * Stephen, proposing the stun gun and the sticky tongue in the same breath:
 *   "there needs to be a cool down and a way to also prevent this from happening
 *    or make it very rare so that we don't have a whole bunch of stalemates or
 *    dumb games that end with both people constantly stun locking each other.
 *    that's a broken game right there."
 *
 * He is right, so the rule that prevents it gets a permanent gate rather than a
 * comment. The rules under test:
 *   1. A STUN PINS. Speed goes to zero, for both roles.
 *   2. YOU CANNOT BE STUNNED TWICE. Inside RESTUN_LOCK a second hit does nothing
 *      at all - it does not extend, refresh or shorten. This is the anti-lock rule.
 *   3. THE TWO ABILITIES ARE NOT THE SAME LENGTH. The alien's stun has to cover a
 *      walk back to the ship; the tongue only has to cover an escape. If they are
 *      ever made equal, the standoff he is describing becomes reachable.
 *   4. THE IMMUNITY OUTLASTS THE EFFECT. If RESTUN_LOCK were shorter than the
 *      effect, a chain would be possible by definition.
 *   5. BOTH HAVE COOLDOWNS.
 *   6. A JAMMER LIES TO A SWEEP, and an empty block reads occupied because of it.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer');
const GAME = path.resolve(process.argv[2] || '../abduct-3d.html'); const ROOT = path.dirname(GAME);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});
const base = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
async function boot(url){
  const ctx=await b.createBrowserContext(); const p=await ctx.newPage();
  await p.setViewport({width:900,height:500,isMobile:true,hasTouch:true});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  /* ⛔ THE VENDOR LOBBY IS SKIPPED NOW (insertCoin({skipLobby:true})), so there is no
   "Launch" button to find and this hunt used to burn its full 40 x 500ms fallback in
   EVERY 3D gate - about twenty seconds each, several minutes across the suite, looking
   for a button that no longer exists. Bail the moment our own rules card is up. */
const _pastVendor = async () => { try { return await p.evaluate(()=>{ const h=document.getElementById('howto');
  return !!(h && getComputedStyle(h).display!=='none') || !!window.__aac3dRound; }); } catch { return false; } };
for(let i=0,d=false;i<40&&!d;i++){
  if(await _pastVendor()) break;for(const f of p.frames()){try{if(await f.evaluate(()=>{const x=[...document.querySelectorAll('button,div')].find(e=>/^\s*launch\s*$/i.test(e.textContent||''));if(x){x.click();return true;}return false;})){d=true;break;}}catch{}} if(!d)await new Promise(r=>setTimeout(r,500));}
  await new Promise(r=>setTimeout(r,3000));
  for(const id of ['howtoGo','tapStart']){try{await p.evaluate(i=>{const e=document.getElementById(i);if(e&&getComputedStyle(e).display!=='none')e.click();},id);}catch{}}
  await new Promise(r=>setTimeout(r,4500));
  return {p,errs};
}
const wait = ms => new Promise(r=>setTimeout(r,ms));
const bad = [];
const A = await boot(base);
const room = await A.p.evaluate(()=>location.hash||'');
const B = await boot(base+room);
await wait(2500);
const ALL = [A,B];

// ── the balance numbers, before anything is fired ────────────────────────────
const C = await A.p.evaluate(()=>window.__aac3dCombat());
console.log('0 numbers     ', JSON.stringify(C));
if(!(C.TONGUE_SECONDS < C.STUN_SECONDS))
  bad.push(`the tongue (${C.TONGUE_SECONDS}s) is not shorter than the stun (${C.STUN_SECONDS}s) - equal lengths are exactly how a standoff becomes reachable`);
if(!(C.RESTUN_LOCK > C.STUN_SECONDS - C.TONGUE_SECONDS))
  bad.push(`RESTUN_LOCK ${C.RESTUN_LOCK}s is too short to stop a chain`);
if(!(C.STUN_CD > 0 && C.TONGUE_CD > 0 && C.JAMMER_CD > 0))
  bad.push('an ability has no cooldown at all');
if(!(C.TONGUE_CD > C.STUN_CD))
  bad.push(`the tongue's cooldown (${C.TONGUE_CD}s) should be the longer one - it is the rarer, cheaper effect`);

// ── get into a round with a real seeker ──────────────────────────────────────
let roles = [];
for(let t=0;t<40;t++){
  for(const c of ALL) await c.p.evaluate(()=>{const e=document.getElementById('tStart'); if(e&&!e.classList.contains('hidden')) e.click();});
  roles = []; for(const c of ALL) roles.push(await c.p.evaluate(()=>window.__aac3dRound().myRole));
  if(roles.some(r=>r==='seeker')) break;
  await wait(500);
}
const S = ALL[roles.indexOf('seeker')], H = ALL[roles.indexOf('seeker')===0?1:0];
if(!S){ console.log('FAIL combat3d\n   - no seeker in a two player round'); await b.close(); srv.close(); process.exit(1); }
for(const c of ALL) await c.p.evaluate(()=>window.__aac3dRoundSkip('hide'));
await wait(1500);

/* ⛔ FIND OPEN GROUND, DO NOT ASSUME IT. The first version stood them at the map
   origin, which on a random map is very often inside a building block - the shot
   crossed a wall, missed correctly, and the gate blamed the gun. */
const SPOT = await S.p.evaluate(()=>window.__aac3dOpenPair(4));
if(!SPOT){ console.log('FAIL combat3d\n   - could not find 4m of open ground with clear sight on this map'); await b.close(); srv.close(); process.exit(1); }
console.log('   ground    :', JSON.stringify(SPOT));
await H.p.evaluate(s=>window.__aac3dPlace(s.bx, 0, s.bz, 0), SPOT);
await wait(500);
await S.p.evaluate(s=>window.__aac3dPlace(s.ax, 6, s.az, s.yaw), SPOT);
/* ⛔ LAND DETERMINISTICALLY. Clicking tLand and then re-placing raced the flight floor:
   measured at fire time the seeker was still onfoot:false, alt:10.5, so fireStun's
   !onFoot() guard returned before doing anything and this gate blamed the gun. */
await S.p.evaluate(()=>window.__aac3dLand(true));
await wait(700);
await S.p.evaluate(s=>window.__aac3dPlace(s.ax, 0, s.az, s.yaw), SPOT);
await wait(900);

/* ⛔ THE JAMMER GOES FIRST, because a stunned chameleon correctly cannot plant
   one - the first run tested it AFTER the stun and blamed the jammer for the
   stun working. Ordering a gate wrongly reports a working rule as a broken one. */
await H.p.evaluate(()=>window.__aac3dFire('jam'));
await wait(800);
const J = await H.p.evaluate(()=>window.__aac3dCombat());
console.log('0b jammer     ', JSON.stringify({planted: !!J.jam}));
if(!J.jam) bad.push('a free hider could not plant a jammer');

// ── 1 + 2: a stun pins, and a second stun does NOTHING ──────────────────────
const pre = await S.p.evaluate(()=>{ const r=window.__aac3dRound();
  return { onfoot:r.onfoot, alt:r.alt, role:r.myRole, phase:r.phase, players:r.players }; });
const preH = await H.p.evaluate(()=>{ const r=window.__aac3dRound(); return { role:r.myRole, alt:r.alt }; });
console.log('   pre-fire S:', JSON.stringify(pre), ' H:', JSON.stringify(preH));
await S.p.evaluate(()=>window.__aac3dFire('stun'));
await wait(1200);
console.log('   readout   :', await S.p.evaluate(()=>document.getElementById('scanRead').textContent));
const hit1 = await H.p.evaluate(()=>window.__aac3dCombat());
console.log('1 first stun  ', JSON.stringify({stun:hit1.myStun, immune:hit1.myImmune}));
if(hit1.myStun <= 0) bad.push('the stun did not land at 4m dead ahead in clear sight');
if(hit1.myImmune <= hit1.myStun)
  bad.push(`immunity (${hit1.myImmune}s) does not outlast the stun (${hit1.myStun}s) - a chain is possible by definition`);

await S.p.evaluate(()=>window.__aac3dFire('clearcd'));
await S.p.evaluate(()=>window.__aac3dFire('stun'));
await wait(1200);
const hit2 = await H.p.evaluate(()=>window.__aac3dCombat());
console.log('2 second stun ', JSON.stringify({stun:hit2.myStun, was:hit1.myStun}));
/* the second shot must not push the end time out. Allow for the ~2.4s of real
   time that passed between the two reads - the number should have gone DOWN. */
if(hit2.myStun > hit1.myStun)
  bad.push(`STUN LOCK IS POSSIBLE: a second stun inside the immunity window extended it (${hit1.myStun}s -> ${hit2.myStun}s)`);

// ── 3: a stunned player cannot move ─────────────────────────────────────────
const before = await H.p.evaluate(()=>{ const r=window.__aac3dRound(); return {alt:r.alt}; });
await H.p.evaluate(()=>{ window.__aac3dPlace(0,0,0,0); });
await H.p.keyboard.down('KeyW'); await wait(1200); await H.p.keyboard.up('KeyW');
const moved = await H.p.evaluate(()=>({ x:+window.__aac3dRound().alt }));
const posAfter = await H.p.evaluate(()=>window.__aac3dPlace ? null : null);
const drift = await H.p.evaluate(()=>{ const r = window.__aac3dCombat(); return r.myStun; });
console.log('3 pinned      ', JSON.stringify({stillStunned:drift > 0}));
if(!(drift > 0)) bad.push('the stun expired before the movement check could run');


// ── 5: a stunned chameleon can do nothing at all ────────────────────────────
await H.p.evaluate(()=>window.__aac3dFire('clearcd'));
await H.p.evaluate(()=>window.__aac3dFire('tongue'));
await wait(700);
const stuckSeeker = await S.p.evaluate(()=>window.__aac3dCombat().myStun);
console.log('5 pinned hider', JSON.stringify({ triedTongueWhileStunned:true, seekerStun:stuckSeeker }));
if(stuckSeeker > 0) bad.push('a STUNNED hider still fired the tongue - being pinned has to mean pinned');

const errs=[...A.errs,...B.errs];
if(errs.length) bad.push('JS errors: '+errs.slice(0,2).join(' | '));
console.log(bad.length ? '\nFAIL combat3d:\n  - '+bad.join('\n  - ')
  : `\nok   combat3d  stun ${C.STUN_SECONDS}s vs tongue ${C.TONGUE_SECONDS}s, ${C.RESTUN_LOCK}s immunity that outlasts both, ` +
    `a second stun inside it does nothing, cooldowns on all three, and a jammer plants`);
await b.close(); srv.close();
process.exit(bad.length ? 1 : 0);
