/* HOW MUCH OF THE SCREEN IS WRITING?
 *
 *   cd test && node hud3d.mjs [../abduct-3d.html]
 *
 * Stephen, after playing two-player with a friend:
 *   "theres a ton of writing on the screen completely blinding us from the game
 *    and makign it unplayable."
 *
 * He is describing the SIGHT LINE - the middle of the screen, where the game is.
 * A camouflage game is played by LOOKING; anything drawn across the centre is
 * taking away the only thing the player is doing. Chrome belongs at the edges.
 *
 * This measures it implementation-independently: every visible element carrying
 * its own text is walked, its box intersected with the central sight line, and
 * the covered area summed. It names the offenders so the number is actionable
 * rather than just a verdict.
 *
 * SIGHT LINE = x in [12%, 88%], y in [18%, 82%] of the viewport.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
let puppeteer;
try { puppeteer = require_('/workspaces/lucid-winds/node_modules/puppeteer'); }
catch { console.log('hud3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, process.argv[2] || '../abduct-3d.html');
const ROOT = path.dirname(GAME);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});
const base = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});

/* the budget. Measured at 41% of the sight line on the build Stephen played,
   with four stacked lines straight across the middle of the screen. Chrome may
   clip the edges of the sight line; it may not sit in the middle of it. */
const BUDGET_PCT = 8;
const BUDGET_CENTRE_PCT = 1;      // the dead centre third is sacred

const VIEWS = [[667,375],[812,375],[932,430]];
const bad = [], lines = [];

for (const [W,H] of VIEWS) {
  const p = await b.newPage();
  await p.setViewport({width:W,height:H,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await p.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
  for(let i=0,d=false;i<40&&!d;i++){for(const f of p.frames()){try{if(await f.evaluate(()=>{const x=[...document.querySelectorAll('button,div')].find(e=>/^\s*launch\s*$/i.test(e.textContent||''));if(x){x.click();return true;}return false;})){d=true;break;}}catch{}} if(!d)await new Promise(r=>setTimeout(r,500));}
  await new Promise(r=>setTimeout(r,3000));
  for(const id of ['howtoGo','tapStart']){try{await p.evaluate(i=>{const e=document.getElementById(i);if(e&&getComputedStyle(e).display!=='none')e.click();},id);}catch{}}
  await new Promise(r=>setTimeout(r,6000));

  const m = await p.evaluate((budget) => {
    const W = innerWidth, H = innerHeight;
    const sight = { x0: W*0.12, x1: W*0.88, y0: H*0.18, y1: H*0.82 };
    const core  = { x0: W*0.33, x1: W*0.67, y0: H*0.33, y1: H*0.67 };
    const area = r => Math.max(0, r.x1-r.x0) * Math.max(0, r.y1-r.y0);
    const clip = (r, box) => ({ x0:Math.max(r.x0,box.x0), x1:Math.min(r.x1,box.x1),
                                y0:Math.max(r.y0,box.y0), y1:Math.min(r.y1,box.y1) });
    /* own text only - a wrapper repeating its children's words would double count */
    const ownText = el => [...el.childNodes]
      .filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    const hits = [];
    for (const el of document.querySelectorAll('body *')) {
      const t = ownText(el); if (!t) continue;
      /* ⛔ THE OPACITY TEST HAS TO WALK UP. opacity does NOT inherit as a computed
         value, so a paragraph inside a panel at opacity:0 reports 1.0 for itself
         and was counted as writing on the player's screen. #recov is exactly
         that shape - it lives at opacity:0 until a page is actually won - and it
         is 27,000px, four times the next worst element. Blaming the HUD for text
         nobody can see sends you off fixing the wrong panel. Checking the whole
         chain also covers display:none and visibility:hidden ancestors, which
         had the same hole. */
      let hidden = false;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) { hidden = true; break; }
      }
      if (hidden) continue;
      const st = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      const r = { x0:b.left, x1:b.right, y0:b.top, y1:b.bottom };
      const inSight = area(clip(r, sight)), inCore = area(clip(r, core));
      if (inSight > 0) hits.push({ id: el.id || el.className || el.tagName,
        text: t.slice(0, 46), inSight: Math.round(inSight), inCore: Math.round(inCore) });
    }
    const sightArea = area(sight), coreArea = area(core);
    const sum = k => hits.reduce((a,h)=>a+h[k], 0);
    hits.sort((a,b)=> b.inSight - a.inSight);
    return { W, H,
      pct: +(100*sum('inSight')/sightArea).toFixed(1),
      corePct: +(100*sum('inCore')/coreArea).toFixed(1),
      worst: hits.slice(0, 6) };
  }, BUDGET_PCT);

  lines.push(`${W}x${H}  sight line ${m.pct}% covered by text, dead centre ${m.corePct}%`);
  for (const w of m.worst) lines.push(`         ${String(w.inSight).padStart(6)}px  ${w.id}  "${w.text}"`);
  if (m.pct > BUDGET_PCT)
    bad.push(`${W}x${H}: writing covers ${m.pct}% of the sight line (budget ${BUDGET_PCT}%) - worst is ${m.worst[0] ? m.worst[0].id : '?'}`);
  if (m.corePct > BUDGET_CENTRE_PCT)
    bad.push(`${W}x${H}: ${m.corePct}% of the DEAD CENTRE is writing (budget ${BUDGET_CENTRE_PCT}%) - the player is looking through text`);
  await p.close();
}

console.log(lines.join('\n'));
console.log(bad.length ? '\nFAIL hud3d:\n  - ' + bad.join('\n  - ')
  : `\nok   hud3d  the middle of the screen is the game, not the interface (budget ${BUDGET_PCT}% of the sight line, ${BUDGET_CENTRE_PCT}% dead centre)`);
await b.close(); srv.close();
process.exit(bad.length ? 1 : 0);
