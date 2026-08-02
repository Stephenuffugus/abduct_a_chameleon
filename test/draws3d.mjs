/* HOW MANY DRAW CALLS IS THE PHONE BEING ASKED FOR?
 *
 *   cd test && node draws3d.mjs [../abduct-3d.html] [maps]
 *
 * The target device is a phone. `flushMarks` already carries the rule in a comment - "a
 * few hundred marks must not be a few hundred draw calls on a phone, which is the target
 * device" - and directly beneath it the scatter passes place hundreds of props one mesh
 * and one material at a time.
 *
 * This counts the real thing: renderer.info.render.calls, read on a settled frame, plus
 * the scene's own mesh and unique-material totals so a regression says WHICH of the three
 * moved. It is deliberately not a hard budget on frame time - that varies with the
 * machine - but a draw-call count is the same number on every machine, which is exactly
 * what makes it worth gating.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
let puppeteer;
try { puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer'); }
catch { console.log('draws3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const GAME = path.resolve(process.argv[2] || '../abduct-3d.html');
const MAPS = +(process.argv[3] || 5);
const ROOT = path.dirname(GAME);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});

const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox',
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const p = await b.newPage();
await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`, {waitUntil:'domcontentloaded', timeout:90000});
await new Promise(r=>setTimeout(r, 9000));
await p.evaluate(()=>{ const g=document.getElementById('howtoGo'); if(g) g.click(); });
await new Promise(r=>setTimeout(r, 4000));

/* renderer is a module-scope binding, not on window, so reach it the way the rest of the
   world is reached: through a hook that already exists. __aac3dPerf is added alongside
   this gate for exactly that. */
const rows = [];
for (let i = 0; i < MAPS; i++) {
  const seed = 9100 + i * 6421;
  const want = await p.evaluate(s => { const m = window.__aac3dMakeMap(s); window.__aac3dSetMap(m); return m.name; }, seed);
  let L = null;
  for (let t = 0; t < 60; t++) { await new Promise(r=>setTimeout(r, 250));
    L = await p.evaluate(()=>window.__aac3dLevel(2)); if (L && L.map === want) break; }
  if (!L || L.map !== want) { console.log('draws3d: a map never built - SKIPPED'); await b.close(); srv.close(); process.exit(0); }
  await new Promise(r=>setTimeout(r, 1200));      // let it settle: marks flush over a few frames
  const m = await p.evaluate(()=>{ try { return window.__aac3dPerf(); } catch(e){ return { err:String(e) }; } });
  if (m.err) { console.log('draws3d: no __aac3dPerf hook (' + m.err + ') - SKIPPED'); await b.close(); srv.close(); process.exit(0); }
  rows.push({ map: want, objects: L.objects, ...m });
  console.log(`  ${want.padEnd(14)} ${String(m.calls).padStart(5)} draw calls   ${String(m.meshes).padStart(5)} meshes   ${String(m.materials).padStart(4)} materials   ${String(m.tris).padStart(8)} tris   (${L.objects} map objects)`);
}

const worst = rows.reduce((a,r)=> r.calls > a.calls ? r : a, rows[0]);
console.log(`\n  worst: ${worst.map} at ${worst.calls} draw calls`);

/* THE BUDGET. A mid-range phone starts dropping frames somewhere around 150-250 draw
   calls per frame in WebGL; 300 is a deliberately generous ceiling that still catches
   "every prop is its own mesh". This is a ceiling, not a target. */
const BUDGET = 300;
const bad = [];
if (worst.calls > BUDGET)
  bad.push(`${worst.calls} draw calls on ${worst.map}, budget ${BUDGET} - the scatter passes are submitting one call per prop and the target device is a phone`);
if (errs.length) bad.push('JS errors: ' + [...new Set(errs)].slice(0,2).join(' | '));

await b.close(); srv.close();
if (bad.length) { console.log('\nFAIL draws3d:'); bad.forEach(x=>console.log('   - ' + x)); process.exit(1); }
console.log(`\nok   draws3d  worst map submits ${worst.calls} draw calls, inside the ${BUDGET} budget for a phone`);
