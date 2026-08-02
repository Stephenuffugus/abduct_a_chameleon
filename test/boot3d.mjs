/* CAN A FINGER GET INTO THE GAME?
 *
 *   cd test && node boot3d.mjs [../abduct-3d.html]
 *
 * Every other 3D gate in this directory boots by finding the rules card's button and
 * calling e.click(). That skips hit testing, so ten of them were green over a front door
 * no human could open. Measured here with elementFromPoint on a real touchscreen
 * viewport, before the fix:
 *
 *   844x390 landscape : the card is 2793px tall (1137 words) in a 390px view and
 *                       PLAY sat at y=2673 — 2283px below the fold.
 *   390x844 portrait  : 3750px of card, PLAY at y=3610.
 *
 * And scrolling to the bottom did not help: at the button's own centre elementFromPoint
 * returned `btn-launchjoin` in landscape and `btn-invite` in portrait, because Playroom's
 * lobby mounts above z-index 90 and lands a third-party invite button exactly where our
 * play button is. The front door was: read eleven hundred words, scroll two and a half
 * thousand pixels, press PLAY, open somebody else's dialog.
 *
 * This gate asserts the one thing that has to be true before anything else in the game
 * matters: at every viewport, at every scroll position, the topmost element at the centre
 * of the play button is the play button.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
let puppeteer;
try { puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer'); }
catch { console.log('boot3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const GAME = path.resolve(process.argv[2] || '../abduct-3d.html');
const ROOT = path.dirname(GAME);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});

const VIEWS = [[844,390,'phone landscape'], [390,844,'phone portrait'], [932,430,'big landscape'], [667,375,'small landscape']];
const MIN = 44;
const bad = [], lines = [];
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox',
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});

for(const [w,h,name] of VIEWS){
  const p = await b.newPage();
  await p.setViewport({ width:w, height:h, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`, {waitUntil:'domcontentloaded', timeout:90000});
  /* ⛔ WAIT LONG ENOUGH FOR THE VENDOR TO ARRIVE. Playroom's lobby mounts several
     seconds after load, which is the whole point: a gate that measures at t=2s sees a
     clean screen and passes, and the player meets the modal at t=6s. */
  await new Promise(r=>setTimeout(r, 9000));

  const m = await p.evaluate((MIN) => {
    const out = { shown:false, words:0, card:0, probes:[], size:null, overlays:[] };
    const ho = document.getElementById('howto'), gb = document.getElementById('howtoGo');
    if(!ho || !gb) return out;
    out.shown = getComputedStyle(ho).display !== 'none';
    out.words = (ho.innerText||'').trim().split(/\s+/).length;
    out.card  = ho.scrollHeight;
    const at = () => { const r = gb.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
      return { y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height),
               hit: !!(el && (el === gb || el.closest('#howtoGo'))),
               top: el ? (el.id || el.tagName + (el.className ? '.'+String(el.className).slice(0,24) : '')) : 'nothing' }; };
    for(const frac of [0, 0.5, 1]){ ho.scrollTop = ho.scrollHeight * frac; out.probes.push({ frac, ...at() }); }
    const r = gb.getBoundingClientRect(); out.size = { w:Math.round(r.width), h:Math.round(r.height) };
    for(const e of document.body.children){ const cs = getComputedStyle(e);
      if(cs.position === 'fixed' && cs.display !== 'none' && +cs.zIndex >= 60) out.overlays.push((e.id||e.tagName)+' z='+cs.zIndex); }
    return out;
  }, MIN);

  if(!m.shown){ bad.push(`${name}: the rules card never appeared, so a new player has no way in`); await p.close(); continue; }
  lines.push(`  ${name.padEnd(16)} ${String(w+'x'+h).padEnd(9)} card ${m.card}px / ${m.words} words, ` +
             `PLAY ${m.size.w}x${m.size.h} at y=${m.probes.map(x=>x.y).join('/')}`);
  for(const pr of m.probes) if(!pr.hit)
    bad.push(`${name}: at ${Math.round(pr.frac*100)}% scroll a finger on the centre of PLAY hits "${pr.top}", not the button (y=${pr.y} in a ${h}px view)`);
  if(m.size.h < MIN || m.size.w < MIN)
    bad.push(`${name}: PLAY is ${m.size.w}x${m.size.h}, under the ${MIN}px floor`);
  if(errs.length) bad.push(`${name}: JS errors on the boot path: ${errs.slice(0,2).join(' | ')}`);
  await p.close();
}
await b.close(); srv.close();

lines.forEach(l=>console.log(l));
if(bad.length){ console.log('\nFAIL boot3d:'); bad.slice(0,10).forEach(x=>console.log('   - '+x)); process.exit(1); }
console.log('\nok   boot3d  the play button is the topmost thing at its own centre, at every scroll position and every viewport');
