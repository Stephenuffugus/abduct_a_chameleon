/* LOOK AT THE WORLD. Not a gate — a camera.
 *
 *   cd test && node worldshots.mjs [../abduct-3d.html] [outdir]
 *
 * Stephen, 2026-08-02: "i can see through the floor, the water seems to turn into
 * a bright light and theres just an empty void around the levle. all the items are
 * strewn around all disjunct. buildings look the same and everything looks random
 * and sloppy."
 *
 * Twelve gates were green while every one of those was true, because not one of
 * them opens its eyes. This shoots the angles a player actually ends up at,
 * INCLUDING the ones nobody would choose: under the floor, at the edge of the
 * map, straight into water. The images are the deliverable — read them.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer');
const GAME = path.resolve(process.argv[2] || '../abduct-3d.html');
const OUT  = path.resolve(process.argv[3] || '/tmp/aac-shots');
const ROOT = path.dirname(GAME);
fs.mkdirSync(OUT, { recursive:true });
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});
const base = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const p = await b.newPage();
await p.setViewport({width:1000,height:600,deviceScaleFactor:1});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
/* ⛔ THE BOOT PATH IS Launch -> howtoGo -> TAP TO PLAY, and the first one lives in
   PLAYROOM'S OWN IFRAME. insertCoin() renders a lobby with a Launch button and
   nothing in the game starts until it is clicked - `started` is set after
   insertCoin() resolves, so MAP stays null forever and you shoot a black screen
   and call it the world. Every other gate in this directory walks the frames for
   it; skipping that cost me two runs. Documented in reference_headless_webgl_3d. */
/* ⛔ THE VENDOR LOBBY IS SKIPPED NOW (insertCoin({skipLobby:true})), so there is no
   "Launch" button to find and this hunt used to burn its full 40 x 500ms fallback in
   EVERY 3D gate - about twenty seconds each, several minutes across the suite, looking
   for a button that no longer exists. Bail the moment our own rules card is up. */
const _pastVendor = async () => { try { return await p.evaluate(()=>{ const h=document.getElementById('howto');
  return !!(h && getComputedStyle(h).display!=='none') || !!window.__aac3dRound; }); } catch { return false; } };
for(let i=0,done=false;i<40&&!done;i++){
  if(await _pastVendor()) break;
  for(const f of p.frames()){
    try{ if(await f.evaluate(()=>{ const x=[...document.querySelectorAll('button,div')]
          .find(e=>/^\s*launch\s*$/i.test(e.textContent||'')); if(x){ x.click(); return true; } return false; })){ done=true; break; } }catch{}
  }
  if(!done) await new Promise(r=>setTimeout(r,500));
}
await new Promise(r=>setTimeout(r,3000));
for(const id of ['howtoGo','tapStart']){try{await p.evaluate(i=>{const e=document.getElementById(i);if(e&&getComputedStyle(e).display!=='none')e.click();},id);}catch{}}
await new Promise(r=>setTimeout(r,4500));

/* ⛔ POLL FOR THE WORLD. The map arrives over playroom state and is built by the
   render loop, so a flat sleep shoots a black screen and reports it as the game.
   Six seconds was not enough on this box. */
let ready = false;
for(let t=0;t<60;t++){
  ready = await p.evaluate(()=> !!(window.__aac3dCamTo && window.__aac3dCamTo('probe') !== 'no map'));
  if(ready) break;
  await new Promise(r=>setTimeout(r,500));
}
if(!ready){
  const diag = await p.evaluate(()=>({
    hooks: Object.keys(window).filter(k=>k.startsWith('__aac3d')),
    tp: window.__aac3dCamTo ? window.__aac3dCamTo('probe') : 'HOOK MISSING',
    err: (document.getElementById('errorMsg')||{}).textContent || '',
    errVis: (()=>{const e=document.getElementById('errorOverlay'); return e?e.style.display:'?';})(),
    overlays: ['howto','tapStart','rotate','clickToPlay'].map(id=>{
      const e=document.getElementById(id); return id+':'+(e?getComputedStyle(e).display:'none'); }),
  }));
  console.log('WORLD NEVER BUILT —', JSON.stringify(diag, null, 1));
  console.log('PAGE ERRORS:', errs.slice(0,4));
  await p.screenshot({ path: path.join(OUT, '00-stuck.png') });
  await b.close(); srv.close(); process.exit(1);
}
const world = await p.evaluate(()=>{
  const g = window.__aac3dGround ? window.__aac3dGround() : null;
  return { map: g && g.map, keys: g && g.keys, maxShare: g && g.maxShare, hist: g && g.hist };
});
console.log('world:', JSON.stringify(world));

/* We cannot reach `camera` from outside the module, so drive the shots through
   the game's OWN views plus the player's position — which is the honest thing to
   do anyway: these are angles a player can actually reach. */
const shots = [
  ['01-player-eye',  async()=>{}],
  ['02-sky-check',   async()=>{ await p.keyboard.press('KeyV'); }],
  ['03-back-to-eye', async()=>{ await p.keyboard.press('KeyV'); }],
  ['04-walk-north',  async()=>{ await p.keyboard.down('KeyW'); await new Promise(r=>setTimeout(r,2600)); await p.keyboard.up('KeyW'); }],
  ['05-walk-more',   async()=>{ await p.keyboard.down('KeyW'); await new Promise(r=>setTimeout(r,3400)); await p.keyboard.up('KeyW'); }],
  ['06-look-down',   async()=>{ await p.evaluate(()=>{ for(let i=0;i<24;i++) document.dispatchEvent(new MouseEvent('mousemove',{movementX:0,movementY:14})); }); }],
  ['07-look-up',     async()=>{ await p.evaluate(()=>{ for(let i=0;i<48;i++) document.dispatchEvent(new MouseEvent('mousemove',{movementX:0,movementY:-14})); }); }],
  ['08-edge-of-map', async()=>{ console.log('  ->', await p.evaluate(()=>window.__aac3dCamTo('edge'))); await new Promise(r=>setTimeout(r,900)); }],
  ['09-horizon',     async()=>{ console.log('  ->', await p.evaluate(()=>window.__aac3dCamTo('horizon'))); await new Promise(r=>setTimeout(r,900)); }],
  ['10-water',       async()=>{ await p.evaluate(()=>window.__aac3dFreeCam(null));
                                console.log('  ->', await p.evaluate(()=>window.__aac3dCamTo('water'))); await new Promise(r=>setTimeout(r,900)); }],
  ['11-under-floor', async()=>{ console.log('  ->', await p.evaluate(()=>window.__aac3dCamTo('under'))); await new Promise(r=>setTimeout(r,900)); }],
];
for(const [name, act] of shots){
  try{ await act(); }catch(e){ console.log('  (act failed', name, String(e).slice(0,60), ')'); }
  await new Promise(r=>setTimeout(r,900));
  await p.screenshot({ path: path.join(OUT, name+'.png') });
  console.log('shot', name);
}
if(errs.length) console.log('PAGE ERRORS:', errs.slice(0,3));
console.log('\nwrote', OUT);
await b.close(); srv.close();
