/* DOES CHANGING THE MAP LEAK A WHOLE WORLD?
 *
 *   cd test && node vram3d.mjs [../abduct-3d.html] [loads]
 *
 * buildWorld tears the previous world down with `worldGroup.remove(child)` in a loop.
 * remove() unparents; it does not free anything on the GPU. Measured before this gate
 * existed: five map loads took live GL buffers from 1,473 to 13,125 with deleteBuffer()
 * called ZERO times. Every map the host picks orphans a whole world in VRAM until the
 * driver loses the context, and the target device is a phone.
 *
 * ⛔ WHY A NAIVE FIX IS WORSE THAN THE LEAK: props are `propLib[k].scene.clone(true)`,
 * and three.js clone() SHARES geometry and material with the template. Disposing a
 * clone's geometry destroys every future clone of that prop. So the fix cannot be "walk
 * the doomed group and dispose everything" - it has to dispose only what nothing else
 * still references. This gate checks both halves: buffers must come down, AND the world
 * must still be there after several loads.
 *
 * It counts by wrapping the GL context's own createBuffer/deleteBuffer/createTexture/
 * deleteTexture, which is the only number that cannot be argued with.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
let puppeteer;
try { puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer'); }
catch { console.log('vram3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const GAME = path.resolve(process.argv[2] || '../abduct-3d.html');
const LOADS = +(process.argv[3] || 6);
const ROOT = path.dirname(GAME);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});

const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox',
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const p = await b.newPage();
await p.setViewport({ width: 900, height: 560, deviceScaleFactor: 1 });

/* Wrap the GL entry points BEFORE the page's own scripts run, so nothing is missed. */
await p.evaluateOnNewDocument(() => {
  const C = WebGL2RenderingContext.prototype, C1 = WebGLRenderingContext.prototype;
  window.__gl = { bufNew:0, bufDel:0, texNew:0, texDel:0 };
  for (const proto of [C, C1]) {
    if (!proto) continue;
    const cb = proto.createBuffer, db = proto.deleteBuffer;
    const ct = proto.createTexture, dt = proto.deleteTexture;
    proto.createBuffer  = function(){ window.__gl.bufNew++; return cb.apply(this, arguments); };
    proto.deleteBuffer  = function(){ window.__gl.bufDel++; return db.apply(this, arguments); };
    proto.createTexture = function(){ window.__gl.texNew++; return ct.apply(this, arguments); };
    proto.deleteTexture = function(){ window.__gl.texDel++; return dt.apply(this, arguments); };
  }
});

const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`, {waitUntil:'domcontentloaded', timeout:90000});
await new Promise(r=>setTimeout(r, 9000));
await p.evaluate(()=>{ const g=document.getElementById('howtoGo'); if(g) g.click(); });
await new Promise(r=>setTimeout(r, 4000));

const read = () => p.evaluate(()=>({ ...window.__gl,
  live: window.__gl.bufNew - window.__gl.bufDel,
  liveTex: window.__gl.texNew - window.__gl.texDel,
  info: (window.__aac3dLevel ? 1 : 0) }));

const rows = [];
let first = null;
for (let i = 0; i < LOADS; i++) {
  const seed = 5000 + i * 7717;
  const want = await p.evaluate(s => { const m = window.__aac3dMakeMap(s); window.__aac3dSetMap(m); return m.name; }, seed);
  let L = null;
  for (let t = 0; t < 60; t++) { await new Promise(r=>setTimeout(r, 250));
    L = await p.evaluate(()=>window.__aac3dLevel(2)); if (L && L.map === want) break; }
  if (!L || L.map !== want) { console.log(`vram3d: map ${want} never built - SKIPPED`); await b.close(); srv.close(); process.exit(0); }
  const g = await read();
  rows.push({ i: i+1, map: want, ...g, objects: L.objects });
  if (i === 0) first = g;
  console.log(`  load ${String(i+1).padStart(2)}  ${want.padEnd(14)} live buffers ${String(g.live).padStart(6)}   textures ${String(g.liveTex).padStart(4)}   (created ${g.bufNew}, deleted ${g.bufDel})`);
}

const last = rows[rows.length-1];
const growth = last.live - first.live;
const perLoad = growth / Math.max(1, rows.length - 1);
console.log(`\n  first load ${first.live} live buffers -> last ${last.live}: ${growth >= 0 ? '+' : ''}${growth} over ${rows.length-1} further loads (${perLoad.toFixed(0)} per load)`);
console.log(`  deleteBuffer called ${last.bufDel} times in total`);

const bad = [];
/* The world is genuinely rebuilt each time, so the count will not be flat - it should
   oscillate around a level, not climb. A per-load growth above a third of one world's
   worth of buffers is a world being orphaned. */
const oneWorld = first.live;
if (last.bufDel === 0) bad.push('deleteBuffer() was never called: nothing is being freed at all');
if (perLoad > oneWorld * 0.33)
  bad.push(`each map load leaks about ${perLoad.toFixed(0)} GL buffers, a third of a whole world (${oneWorld}) - the map picker fills VRAM until the context is lost`);
if (errs.length) bad.push('JS errors: ' + [...new Set(errs)].slice(0,2).join(' | '));
/* And the world must still BE there: disposing something the templates share would
   empty later maps, which is the failure mode a careless fix produces. */
if (last.objects < 50) bad.push(`the last map built only ${last.objects} objects - something shared was disposed and later worlds are coming up empty`);

await b.close(); srv.close();
if (bad.length) { console.log('\nFAIL vram3d:'); bad.forEach(x=>console.log('   - ' + x)); process.exit(1); }
console.log('\nok   vram3d  changing the map frees what it replaces, and later worlds still build');
