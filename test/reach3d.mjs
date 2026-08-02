/* CAN A FINGER ACTUALLY REACH IT?
 *
 *   cd test && node reach3d.mjs [../abduct-3d.html]
 *
 * Stephen, 2026-08-02, after paint3d and studio3d both went green:
 *   "the coloring is actually completely broken. now I tried to color myself.
 *    none of it f****** work. I tried the fill. I tried using the autoclick
 *    match background and s*** it's f****** horrible. none of it works."
 *
 * ⛔⛔ THE REASON THE GATES MISSED IT: they press buttons with el.click(), which
 * dispatches straight to the handler and SKIPS HIT TESTING ENTIRELY. A control
 * buried under another element, pushed off screen, or covered by a transparent
 * panel still "clicks" perfectly in a harness and does nothing under a thumb.
 * This project has been here before - "a panel that fits is not a panel that
 * works" - and .click() is the same lie in a different costume.
 *
 * So this asks the only question that matters: for every control, put a point at
 * its centre and ask the DOCUMENT what is there. If the answer is not that
 * control (or something inside it), a real finger lands on whatever IS.
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
const bad = [];
const VIEWPORTS = [[932,430],[915,412],[883,400],[844,390],[800,380],[740,360],[667,375],[1008,452]];

/* the controls a player MUST be able to press to paint themselves at all */
const MUST = ['tPaint','matchBtn','matchCoverBtn','fillBtn','clearBtn','paintDone','paintClose','pickBtn'];

for(const [W,H] of VIEWPORTS){
  const ctx = await b.createBrowserContext(); const page = await ctx.newPage();
  await page.setViewport({ width:W, height:H, isMobile:true, hasTouch:true, deviceScaleFactor:1 });
  const errs = []; page.on('pageerror', e=> errs.push(e.message));
  await page.goto(base, { waitUntil:'domcontentloaded', timeout:90000 });
  /* ⛔ THE VENDOR LOBBY IS SKIPPED NOW (insertCoin({skipLobby:true})), so there is no
   "Launch" button to find and this hunt used to burn its full 40 x 500ms fallback in
   EVERY 3D gate - about twenty seconds each, several minutes across the suite, looking
   for a button that no longer exists. Bail the moment our own rules card is up. */
const _pastVendor = async () => { try { return await page.evaluate(()=>{ const h=document.getElementById('howto');
  return !!(h && getComputedStyle(h).display!=='none') || !!window.__aac3dRound; }); } catch { return false; } };
for(let i=0,d=false;i<40&&!d;i++){
  if(await _pastVendor()) break; for(const f of page.frames()){ try{ if(await f.evaluate(()=>{
    const x=[...document.querySelectorAll('button,div')].find(e=>/^\s*launch\s*$/i.test(e.textContent||''));
    if(x){x.click();return true;} return false; })){ d=true; break; } }catch{} } if(!d) await new Promise(r=>setTimeout(r,500)); }
  await new Promise(r=>setTimeout(r,3000));
  for(const id of ['howtoGo','tapStart']){ try{ await page.evaluate(i=>{ const e=document.getElementById(i);
    if(e&&getComputedStyle(e).display!=='none') e.click(); }, id); }catch{} }
  await new Promise(r=>setTimeout(r,5000));

  /* open the studio the way a player does — a real tap on the 🎨 button */
  const pb = await page.evaluate(()=>{ const e=document.getElementById('tPaint');
    if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}; });
  if(!pb){ bad.push(`${W}x${H}: there is no paint button at all`); await ctx.close(); continue; }
  await page.touchscreen.tap(pb.x, pb.y);
  await new Promise(r=>setTimeout(r,1400));

  const open = await page.evaluate(()=> !document.getElementById('paint').classList.contains('hidden'));
  if(!open){ bad.push(`${W}x${H}: a real TAP on the paint button did not open the studio (el.click() does — so something is on top of it)`); }

  const probe = await page.evaluate((ids)=>{
    const out = {};
    for(const id of ids){
      const el = document.getElementById(id);
      if(!el){ out[id] = { missing:true }; continue; }
      const r = el.getBoundingClientRect();
      const cx = r.x + r.width/2, cy = r.y + r.height/2;
      const onScreen = r.width>0 && r.height>0 && cx>=0 && cy>=0 && cx<=innerWidth && cy<=innerHeight;
      const hit = onScreen ? document.elementFromPoint(cx, cy) : null;
      const mine = hit ? (hit === el || el.contains(hit) || hit.contains(el)) : false;
      out[id] = { w:Math.round(r.width), h:Math.round(r.height), onScreen, mine,
                  hit: hit ? (hit.id || hit.className || hit.tagName) : 'nothing',
                  vis: getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' };
    }
    return out;
  }, MUST);

  const broken = [];
  for(const id of MUST){
    const p = probe[id];
    if(!p || p.missing){ broken.push(`${id} MISSING`); continue; }
    if(!p.vis) continue;                       // legitimately hidden in this state
    if(!p.onScreen){ broken.push(`${id} OFF SCREEN`); continue; }
    if(p.h < 44 || p.w < 44) broken.push(`${id} ${p.w}x${p.h} under 44px`);
    if(!p.mine) broken.push(`${id} is COVERED BY "${p.hit}" — a finger cannot reach it`);
  }
  console.log(`${W}x${H}  studioOpen=${open}  ` + MUST.map(i=>{
    const p=probe[i]; return `${i}:${!p||p.missing?'MISSING':(!p.vis?'hidden':(p.mine?'ok':'COVERED('+p.hit+')'))}`;
  }).join(' '));
  for(const msg of broken) bad.push(`${W}x${H}: ${msg}`);
  if(errs.length) bad.push(`${W}x${H}: JS error — ${errs[0]}`);
  await ctx.close();
}

console.log(bad.length ? '\nFAIL reach3d:\n  - ' + bad.join('\n  - ')
  : '\nok   reach3d  every control a player needs to paint themselves is on screen, 44px, and the topmost thing at its own centre');
await b.close(); srv.close();
process.exit(bad.length ? 1 : 0);
