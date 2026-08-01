/* THE SEEKER'S TWO MINUTES ARE A LESSON, NOT A WAITING ROOM.
 *
 *   cd test && node calib3d.mjs
 *
 * HIDE_SECONDS is 120. A seeker used to spend all of it blindfolded behind a
 * case file they were simply handed - Stephen: "i shipped a LIBRARY and he was
 * right that nobody reads a menu; a page is only worth something if arriving is
 * an EVENT". The wait now opens on a calibration board: one painted body hidden
 * among honest decoys, tap it, and the page you win is the page you earned.
 *
 * The rules that make it training instead of decoration:
 *   1. THE WINDOW OPENS ON THE DRILL. Not on a page you did nothing for.
 *   2. THE DIFFICULTY IS HONEST. "88% match" is scored by the REAL matchColor,
 *      so what you learn here is true out there. A lying trainer is worse than
 *      no trainer.
 *   3. A HIT PAYS EXACTLY ONE PAGE, and the card is VISIBLE - #recov lives at
 *      z-index 24 and the blindfold at 64, so this is a real way to lose.
 *   4. A MISS PAYS NOTHING.
 *   5. IT CANNOT BE FARMED. Three targets a window, then it is spent.
 *   6. BOTH TABS ARE REACHABLE at 44px, and the archive is always one tap away.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer');
const GAME = path.resolve('../abduct-3d.html'); const ROOT = path.dirname(GAME);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});
const base = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
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
const wait = ms => new Promise(r=>setTimeout(r,ms));
const bad = [];

/* ⛔ TWO CLIENTS. Three would let us catch a hider with the round still running
   - the state this feature exists for - but three swiftshader contexts starve a
   two core box and the third one times out the CDP connection. So the dead time
   under test here is the INTERMISSION, which shares the same code path. */
const A = await boot(base);
const room = await A.p.evaluate(()=>location.hash||'');
const B = await boot(base+room);
await wait(2500);

/* a real round, because the blindfold only exists inside one.
   ⛔ POLL, DO NOT SLEEP. A flat 2.5s wait for the second client to be seen and
   for START to take passed alone and failed inside the suite - the same timing
   assumption that bit files3d. Both clients have to agree there are 2 players
   before START is even offered. */
const ALL = [A,B];
let roles = [];
for(let t=0; t<40; t++){
  for(const c of ALL) await c.p.evaluate(()=>{const e=document.getElementById('tStart'); if(e && !e.classList.contains('hidden')) e.click();});
  roles = [];
  for(const c of ALL) roles.push(await c.p.evaluate(()=>window.__aac3dRound().myRole));
  if(roles.some(r=> r==='seeker')) break;
  await wait(500);
}
/* ⛔ HOLD THE HIDE WINDOW OPEN. It is 120 seconds and everything below runs
   inside it: twelve board deals now each build three rigs and take a render, so
   the blindfold was closing UNDER the test and hits two and three landed with no
   panel up - which read as "the card is behind the blindfold" and "the archive
   did not grow". The failure was the clock, not the game. */
for(const c of ALL) await c.p.evaluate(()=>window.__aac3dRoundSkip('holdHide'));
const S = ALL[roles.indexOf('seeker')] || null;
const HIDERS = ALL.filter((c,i)=> roles[i] !== 'seeker');
if(!S){ console.log('FAIL calib3d\n   - no seeker in a two player round, so the blindfold never opened'); await b.close(); srv.close(); process.exit(1); }

// 1. the window opens on the drill
const opened = await S.p.evaluate(()=>{
  const hw = document.getElementById('hidewait');
  return { on: hw.classList.contains('on'), cal: hw.classList.contains('cal'),
           calVis: getComputedStyle(document.getElementById('hwCal')).display !== 'none',
           cardVis: getComputedStyle(document.getElementById('hwCard')).display !== 'none',
           live: window.__aac3dCal.state().live, hint: document.getElementById('calHint').textContent,
           real3d: window.__aac3dCal.state().real3d, players: window.__aac3dRound().players };
});
console.log('1 window opens', JSON.stringify(opened));
if(!opened.on)   bad.push('the seeker was not blindfolded at all');
if(!opened.cal)  bad.push('the wait did not open on the calibration drill');
if(!opened.calVis) bad.push('the drill is on the wrong tab to be seen');
if(opened.cardVis) bad.push('a case file was handed over anyway - the drill is not the front of the window');
if(!opened.live) bad.push('no target was dealt when the window opened');

// 2. the difficulty is honest - scored by the game's own matchColor
const honesty = await S.p.evaluate(()=>{
  const out = [];
  for(const t of ['#4FA83F','#8A8FA3','#F0D68A','#42465C','#8FD7F2'])
    for(const acc of [0.78,0.88,0.96]) out.push({ t, acc, got:+window.__aac3dCal.verify(t, acc).toFixed(3) });
  return out;
});
const worst = honesty.reduce((w,h)=> Math.abs(h.got-h.acc) > Math.abs(w.got-w.acc) ? h : w);
console.log('2 honest ramp ', `${honesty.length} checks, worst drift ${(Math.abs(worst.got-worst.acc)*100).toFixed(1)}pp on ${worst.t} @ ${worst.acc}`);
if(Math.abs(worst.got - worst.acc) > 0.02)
  bad.push(`the drill lies about difficulty: asked for ${worst.acc} on ${worst.t}, the real scorer says ${worst.got}`);

// 6. both tabs reachable at 44px, and switching works both ways
const tabs = await S.p.evaluate(()=>{
  const r = id => { const e=document.getElementById(id); const b=e.getBoundingClientRect(); return {w:+b.width.toFixed(0),h:+b.height.toFixed(0)}; };
  const hw = document.getElementById('hidewait');
  document.getElementById('hwTabFile').click();
  const onFile = { cal: hw.classList.contains('cal'),
                   cardVis: getComputedStyle(document.getElementById('hwCard')).display !== 'none' };
  document.getElementById('hwTabCal').click();
  const backOnCal = hw.classList.contains('cal');
  return { cal:r('hwTabCal'), file:r('hwTabFile'), onFile, backOnCal };
});
console.log('3 tabs        ', JSON.stringify(tabs));
if(tabs.cal.h < 44 || tabs.file.h < 44) bad.push(`tab buttons are ${Math.min(tabs.cal.h,tabs.file.h)}px tall, under the 44px floor`);
if(tabs.onFile.cal || !tabs.onFile.cardVis) bad.push('the CASE FILE tab does not reach the archive');
if(!tabs.backOnCal) bad.push('you cannot get back to the drill once you leave it');

/* 2b. THE ANSWER IS THE BEST MATCH ON THE BOARD. Two of the decoys are bodies
   too, so shape alone cannot win it - but if a decoy ever scores closer than the
   target, the drill teaches the wrong instinct. */
const board = await S.p.evaluate(()=>{
  const out = [];
  for(let i=0;i<12;i++){ const t = window.__aac3dCal.deal();
    out.push({ acc:t.acc, decoys:t.decoyAcc }); }
  window.__aac3dCal.deal();
  return out;
});
const inverted = board.filter(b=> b.decoys.some(d=> d >= b.acc));
console.log('2b answer best', `${board.length} boards, closest decoy ${Math.max(...board.map(b=>Math.max(...b.decoys))).toFixed(2)} vs target ${board[0].acc}`);
if(inverted.length) bad.push(`${inverted.length}/${board.length} boards had a decoy matching the ground BETTER than the answer`);

// 4. a miss pays nothing
const missed = await S.p.evaluate(async ()=>{
  const before = window.__aac3dFiles.state().found;
  window.__aac3dCal.deal();
  window.__aac3dCal.tapMiss();
  await new Promise(r=>setTimeout(r,200));
  return { before, after: window.__aac3dFiles.state().found, round: window.__aac3dCal.state().round,
           msg: window.__aac3dCal.state().msg };
});
console.log('4 a miss      ', JSON.stringify(missed));
if(missed.after !== missed.before) bad.push(`a miss paid ${missed.after-missed.before} page(s)`);
if(missed.round !== 0) bad.push('a miss burned one of the three targets');
if(!/look for/i.test(missed.msg)) bad.push('a miss does not tell you what you were looking for');

// 3+5. three hits pay exactly three pages, and the fourth pays nothing
const hits = await S.p.evaluate(async ()=>{
  const start = window.__aac3dFiles.state().found;
  const steps = [];
  for(let i=0;i<3;i++){
    for(let t=0;t<40 && !window.__aac3dCal.state().live;t++) await new Promise(r=>setTimeout(r,100));
    const acc = window.__aac3dCal.state().acc;
    window.__aac3dCal.tapTarget();
    const card = document.getElementById('recov'), hw = document.getElementById('hidewait');
    /* ⚠ The card slides in over 0.5s, but under swiftshader the compositor is so
       far behind the main thread that computed opacity sat at 0 for 1.3s and
       then SNAPPED to 1 - measured, not guessed. So poll generously: the claim
       is "it does become visible", not "it animates at 60fps in a headless VM".
       A fixed 250ms read called a working animation a bug. */
    for(let t=0;t<50 && +getComputedStyle(card).opacity < 0.9;t++) await new Promise(r=>setTimeout(r,100));
    /* ⛔ DO NOT ask elementFromPoint who is on top here. #recov carries
       pointer-events:none by design, so hit testing skips it and the answer is
       always "the panel underneath" - this reported the card as buried on all
       three hits while it was in fact drawn correctly in front. A false red
       costs the same as a false green. Both elements are direct children of
       <body> with no transformed ancestor, so painting order IS the z-index. */
    const zi = el => parseInt(getComputedStyle(el).zIndex, 10) || 0;
    steps.push({ acc, found: window.__aac3dFiles.state().found - start,
                 cardUp: card.classList.contains('on'),
                 cardOnTop: card.parentElement === document.body && hw.parentElement === document.body
                            && zi(card) > zi(hw),
                 z: zi(card) + ' vs ' + zi(hw),
                 vis: getComputedStyle(card).opacity,
                 why: (document.getElementById('recovWhy')||{}).textContent||'' });
    await new Promise(r=>setTimeout(r,1700));
  }
  const st = window.__aac3dCal.state();
  window.__aac3dCal.tapTarget();                      // a fourth try, after it is spent
  await new Promise(r=>setTimeout(r,300));
  return { steps, done: st.done, live: st.live, total: window.__aac3dFiles.state().found - start };
});
console.log('5 three hits  ', JSON.stringify(hits.steps.map(s=>({acc:s.acc, found:s.found, card:s.cardUp, z:s.z, opacity:s.vis}))));
console.log('6 then spent  ', JSON.stringify({done:hits.done, live:hits.live, totalPages:hits.total}));
hits.steps.forEach((s,i)=>{
  if(s.found !== i+1) bad.push(`hit ${i+1} left the archive at ${s.found} pages, expected ${i+1}`);
  if(!s.cardUp) bad.push(`hit ${i+1} did not put a recovery card up - finding a page was not an event`);
  if(!s.cardOnTop) bad.push(`hit ${i+1}'s card is behind the blindfold (${s.z}) - the reward is invisible`);
  if(+s.vis < 0.9) bad.push(`hit ${i+1}'s card never faded in (opacity ${s.vis})`);
  if(!/SPOTTED/i.test(s.why)) bad.push(`hit ${i+1}'s card does not say why you got it ("${s.why}")`);
});
const ramp = hits.steps.map(s=>s.acc);
if(!(ramp[0] < ramp[1] && ramp[1] < ramp[2])) bad.push(`the three targets do not get harder (${ramp.join(' → ')})`);
if(!hits.done) bad.push('the drill did not close after three targets');
if(hits.live)  bad.push('a fourth target was dealt - the drill can be farmed');
if(hits.total !== 3) bad.push(`three targets paid ${hits.total} pages, expected 3`);

/* 7. THE THIRD PLACEMENT. The plan: "the same panel serves the 7s intermission
   and a caught hider spectating. Both are dead time today." A hider taken at
   second 5 of a 150s round has 145 seconds of nothing. It is a BUTTON and not a
   takeover - watching the round finish is worth something too.
   ⛔ GATE THE CAUGHT HIDER, NOT THE INTERMISSION. The first version drove the
   intermission and failed on "the button came back" - because the intermission
   is SEVEN SECONDS and it had simply ended mid-test. The caught hider is both
   the stabler test and the hole that actually matters. */
const H = HIDERS[0];
for(const c of ALL) await c.p.evaluate(()=>window.__aac3dRoundSkip('round'));
let ph = '';
for(let t=0;t<20 && ph!=='intermission';t++){ await wait(300);
  /* hold it open the moment it arrives - seven seconds is not enough to click a
     button and read the answer over synced state on a two core box */
  for(const c of ALL) await c.p.evaluate(()=>window.__aac3dRoundSkip('holdInter'));
  ph = await H.p.evaluate(()=>window.__aac3dRound().phase); }
for(const c of ALL) await c.p.evaluate(()=>window.__aac3dRoundSkip('holdInter'));
await wait(600);
const spec = await H.p.evaluate(async ()=>{
  const nap = ms => new Promise(r=>setTimeout(r,ms));
  const btn = document.getElementById('tCal'), hw = document.getElementById('hidewait');
  const shown = !btn.classList.contains('hidden');
  btn.click(); await nap(600);
  const open = { on:hw.classList.contains('on'), cal:hw.classList.contains('cal'),
                 spec:hw.classList.contains('spec'),
                 closeVis:getComputedStyle(document.getElementById('hwClose')).display !== 'none',
                 live:window.__aac3dCal.state().live,
                 lead:(hw.querySelector('.lead')||{}).textContent||'' };
  document.getElementById('hwClose').click(); await nap(600);
  return { shown, open, closed: !hw.classList.contains('on'),
           btnBack: !document.getElementById('tCal').classList.contains('hidden'),
           /* ⛔ the intermission is SEVEN SECONDS. The first run of this failed
              on "the button came back" because the dead time had simply ended
              under it - so read the phase at the same instant and only hold the
              button to account while there is still dead time to fill. */
           stillDead: window.__aac3dRound().phase === 'intermission' };
});
console.log('7 dead time   ', JSON.stringify({phase:ph, ...spec}));
if(ph !== 'intermission') bad.push(`could not reach the dead time (phase ${ph})`);
else {
  if(!spec.shown)          bad.push('nothing is offered in the dead time - it is still dead');
  if(!spec.open.on || !spec.open.cal || !spec.open.spec) bad.push('the CALIBRATE button did not open the drill');
  if(!spec.open.live)      bad.push('the drill opened with no target on the board');
  if(!spec.open.closeVis)  bad.push('no way back out - the panel stole the map instead of offering itself');
  if(!/TAKEN|BETWEEN ROUNDS/i.test(spec.open.lead)) bad.push(`the panel still calls you the hunter ("${spec.open.lead}")`);
  if(!spec.closed)         bad.push('BACK did not return you to watching');
  if(spec.stillDead && !spec.btnBack) bad.push('once closed there is no way to open it again');
}

const errs = [...A.errs, ...B.errs];
if(errs.length) bad.push('JS errors: ' + errs.slice(0,2).join(' | '));
console.log(bad.length ? '\nFAIL calib3d:\n  - ' + bad.join('\n  - ')
  : `\nok   calib3d  the wait opens on the drill, difficulty honest to ${(Math.abs(worst.got-worst.acc)*100).toFixed(1)}pp of the real scorer, ` +
    `ramp ${ramp.join(' → ')}, 3 hits = 3 pages each with a card over the blindfold, a miss pays 0, a 4th tap pays 0, and the dead time offers the same drill with a way back out`);
await b.close(); srv.close();
process.exit(bad.length ? 1 : 0);
