/* Does a RELOAD leave a ghost of yourself in the room?
 * If it does, a solo player becomes "2 players", a formal round starts, and one
 * of them is put in a UFO - which is exactly what the Director described. */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer');
const GAME=path.resolve(process.argv[2]||'../abduct-3d.html'); const ROOT=path.dirname(GAME);
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv=await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});
const base=`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const p=await b.newPage(); await p.setViewport({width:932,height:430,isMobile:true,hasTouch:true,deviceScaleFactor:1});
async function settle(){
  for(let i=0,d=false;i<40&&!d;i++){for(const f of p.frames()){try{if(await f.evaluate(()=>{const x=[...document.querySelectorAll('button,div')].find(e=>/^\s*launch\s*$/i.test(e.textContent||''));if(x){x.click();return true;}return false;})){d=true;break;}}catch{}} if(!d)await new Promise(r=>setTimeout(r,500));}
  await new Promise(r=>setTimeout(r,3000));
  for(const id of ['howtoGo','tapStart']){try{await p.evaluate(i=>{const e=document.getElementById(i);if(e&&getComputedStyle(e).display!=='none')e.click();},id);}catch{}}
  await new Promise(r=>setTimeout(r,5000));
}
const snap=()=>p.evaluate(()=>({ url:location.href.split('/').pop(), ...(window.__aac3dRound?window.__aac3dRound():{}) }));
await p.goto(base,{waitUntil:'domcontentloaded',timeout:90000}); await settle();
console.log('first load   ', JSON.stringify(await snap()));
for(let n=1;n<=3;n++){
  await p.reload({waitUntil:'domcontentloaded',timeout:90000}); await settle();
  console.log(`after reload ${n}`, JSON.stringify(await snap()));
}
await b.close(); srv.close();
