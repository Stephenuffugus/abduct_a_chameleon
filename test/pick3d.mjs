/* POINT AT A THING, GET ITS COLOUR, AND HAVE THAT COLOUR ACTUALLY SCORE.
 *
 *   cd test && node pick3d.mjs [../abduct-3d.html]
 *
 * Stephen, after the two-player test:
 *   "the match color didnt work at all it wasnt at all right. the color selector
 *    should be a click the button to match and then click what you want to match
 *    color then you paint with that color."
 *
 * The second sentence is the fix for the first. Measured before this existed: at
 * a spot with cover nearby you are scored against TWO surfaces, the second one
 * labelled only "NEARBY COVER" with no name and no swatch - so a player could
 * fill themselves with a perfect copy of the ground and be told 45%, correctly,
 * with no way to find out why. An eyedropper is how the game finally shows you
 * what it is asking for.
 *
 * The rules that make it worth having:
 *   1. ARMING IS VISIBLE AND REVERSIBLE. You can tell it is armed and get out.
 *   2. AN ARMED TAP DOES NOT PAINT. Otherwise picking dabs your body first.
 *   3. THE PICK LOADS THE BRUSH with what you actually tapped.
 *   4. ⭐ THE PICKED COLOUR SCORES WHERE IT WAS TAKEN. This is the whole point.
 *      A picker that samples a LIT PIXEL rather than the surface's own colour
 *      would hand you something that looks right and scores badly - the exact
 *      complaint it is meant to answer. Fed back through the game's own scorer,
 *      a pick must come out near perfect.
 *   5. 44px, and Escape backs out of the picker before it closes the studio.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
let puppeteer;
try { puppeteer = require_('/workspaces/lucid-winds/node_modules/puppeteer'); }
catch { console.log('pick3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, process.argv[2] || '../abduct-3d.html');
const ROOT = path.dirname(GAME);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});
const base = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const bad = [], lines = [];

for (const [W,H] of [[667,375],[932,430]]) {
  const p = await b.newPage();
  await p.setViewport({width:W,height:H,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
  for(let i=0,d=false;i<40&&!d;i++){for(const f of p.frames()){try{if(await f.evaluate(()=>{const x=[...document.querySelectorAll('button,div')].find(e=>/^\s*launch\s*$/i.test(e.textContent||''));if(x){x.click();return true;}return false;})){d=true;break;}}catch{}} if(!d)await new Promise(r=>setTimeout(r,500));}
  await new Promise(r=>setTimeout(r,3000));
  for(const id of ['howtoGo','tapStart']){try{await p.evaluate(i=>{const e=document.getElementById(i);if(e&&getComputedStyle(e).display!=='none')e.click();},id);}catch{}}
  await new Promise(r=>setTimeout(r,6000));

  const tag = `${W}x${H}`;
  const m = await p.evaluate(async () => {
    const nap = ms => new Promise(r=>setTimeout(r,ms));
    const S = window.__aac3dStudio;
    document.getElementById('tPaint').click();      // open the studio the way a player does
    await nap(900);
    const btn = document.getElementById('pickBtn');
    const bb = btn ? btn.getBoundingClientRect() : null;
    const before = S.brush();

    // 1. arming shows itself
    S.pickArm(true); await nap(120);
    const armedOn = { armed: btn.classList.contains('armed'),
                      label: (btn.textContent||'').trim(),
                      body: document.body.classList.contains('picking') };
    /* 5. escape backs out of the picker, not the studio.
       ⛔ ONCE. Dispatching on document AND window fired the handler twice - the
       first cancelled the picker, the second closed the whole studio, and every
       tap below then happened with the studio shut and reported the feature
       broken. The listener is on window and keydown bubbles, so one dispatch is
       one press. */
    dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}));
    await nap(200);
    const afterEsc = { stillArmed: !!document.body.classList.contains('picking'),
                       studioOpen: !document.getElementById('paint').classList.contains('hidden') };

    /* 2-4. arm again and TAP THE WORLD through the real pointer path. Several
       points, because one lucky sample proves nothing. */
    const shots = [];
    /* whatever Escape did, be in the studio before testing taps */
    if(document.getElementById('paint').classList.contains('hidden')){
      document.getElementById('tPaint').click(); await nap(800);
    }
    for(const [fx,fy] of [[0.30,0.72],[0.52,0.80],[0.68,0.66],[0.42,0.62]]){
      S.pickArm(true); await nap(80);
      const x = Math.round(innerWidth*fx), y = Math.round(innerHeight*fy);
      const peek = S.pickAt(x, y);                 // what is under that pixel
      const cov0 = S.silhouette ? S.silhouette() : null;
      S.drag(x, y, x, y);                          // a real armed tap
      await nap(150);
      const got = S.brush();
      let score = null, tones = null, isATone = null, bestTwo = null;
      if(peek){
        const c = window.__aac3dCamo(peek.x, peek.z, got, got);
        score = c.single;
        tones = c.tones.map(t=>t.hex.toLowerCase());
        /* ⭐ THE REAL CONTRACT. A single tone CANNOT score 1.0 where two surfaces
           are being weighed - that is the whole reason this feature exists. What
           must be true is that the picker hands back a colour the scorer is
           actually asking for, i.e. one of the tones at that spot. */
        isATone = tones.indexOf(got.toLowerCase()) >= 0;
        if(c.tones.length > 1)
          bestTwo = window.__aac3dCamo(peek.x, peek.z, c.tones[0].hex, c.tones[1].hex).mq;
      }
      shots.push({ peek: peek && { hex:peek.hex, name:peek.name },
                   brush: got, matches: !!(peek && got.toLowerCase() === peek.hex.toLowerCase()),
                   score: score == null ? null : +score.toFixed(3),
                   tones, isATone, bestTwo: bestTwo == null ? null : +bestTwo.toFixed(3),
                   stillArmed: document.body.classList.contains('picking') });
    }
    return { before, bb: bb && { w:Math.round(bb.width), h:Math.round(bb.height) },
             armedOn, afterEsc, shots };
  });

  lines.push(`${tag}  button ${m.bb ? m.bb.w+'x'+m.bb.h : 'MISSING'}, armed label "${m.armedOn.label}"`);
  for(const s of m.shots)
    lines.push(`        tapped ${s.peek ? s.peek.name.padEnd(9) : '(nothing)'} ${s.peek ? s.peek.hex : ''} -> brush ${s.brush}  ` +
      `alone ${s.score}` + (s.bestTwo != null ? `, both tones ${s.bestTwo}` : ' (only surface here)') +
      (s.isATone === false ? '  ⛔ NOT A TONE' : ''));

  if(!m.bb) bad.push(`${tag}: there is no PICK A COLOUR button`);
  else if(m.bb.h < 44) bad.push(`${tag}: the picker button is ${m.bb.h}px tall, under the 44px floor`);
  if(!m.armedOn.armed || !m.armedOn.body) bad.push(`${tag}: arming the picker does not show that it is armed`);
  if(!/tap|cancel/i.test(m.armedOn.label)) bad.push(`${tag}: an armed picker still reads "${m.armedOn.label}" - it never says what to do next`);
  if(m.afterEsc.stillArmed) bad.push(`${tag}: Escape did not cancel the picker`);
  if(!m.afterEsc.studioOpen) bad.push(`${tag}: Escape closed the whole studio instead of just the picker`);

  const real = m.shots.filter(s => s.peek);
  if(real.length < 3) bad.push(`${tag}: only ${real.length}/4 taps hit anything at all`);
  for(const s of real){
    if(!s.matches) bad.push(`${tag}: tapped ${s.peek.name} ${s.peek.hex} but the brush became ${s.brush}`);
    /* ⭐ the assertion the whole feature exists for */
    if(s.isATone === false)
      bad.push(`${tag}: picked ${s.peek.name} ${s.brush}, but the scorer at that spot is asking for ${s.tones.join(' / ')} - the picker and the scorer disagree`);
    if(s.tones && s.tones.length === 1 && s.score != null && s.score < 0.98)
      bad.push(`${tag}: only one surface counts at that spot, yet the picked colour scores ${s.score} instead of full marks`);
    if(s.bestTwo != null && s.bestTwo < 0.98)
      bad.push(`${tag}: even both picked tones together only reach ${s.bestTwo} - the two-tone ceiling is unreachable`);
    if(s.stillArmed) bad.push(`${tag}: the picker stayed armed after a pick, so the next tap steals a colour instead of painting`);
  }
  if(errs.length) bad.push(`${tag}: JS errors: ${errs.slice(0,2).join(' | ')}`);
  await p.close();
}

console.log(lines.join('\n'));
console.log(bad.length ? '\nFAIL pick3d:\n  - ' + bad.join('\n  - ')
  : '\nok   pick3d  arm it, tap anything in the world, and that surface\'s own colour lands on the brush and scores where it was taken');
await b.close(); srv.close();
process.exit(bad.length ? 1 : 0);
