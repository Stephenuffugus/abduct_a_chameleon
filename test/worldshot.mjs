import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer');
const GAME=path.resolve(process.argv[2]||'../abduct-3d.html'); const OUT=path.resolve(process.argv[3]||'.');
const ROOT=path.dirname(GAME); fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv=await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});
const url=`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const p=await b.newPage(); await p.setViewport({width:1280,height:720,deviceScaleFactor:1});
await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
for(let i=0,d=false;i<40&&!d;i++){for(const f of p.frames()){try{if(await f.evaluate(()=>{const x=[...document.querySelectorAll('button,div')].find(e=>/^\s*launch\s*$/i.test(e.textContent||''));if(x){x.click();return true;}return false;})){d=true;break;}}catch{}} if(!d)await new Promise(r=>setTimeout(r,500));}
await new Promise(r=>setTimeout(r,3000));
for(const id of ['howtoGo','tapStart']){try{await p.evaluate(i=>{const e=document.getElementById(i);if(e&&getComputedStyle(e).display!=='none')e.click();},id);}catch{}}
await new Promise(r=>setTimeout(r,6000));
await p.screenshot({path:OUT+'/world-eye.png'});
// the hider's own sky check is a supported view and gives the wide read
await p.evaluate(()=>{ const t=document.getElementById('tView'); if(t) t.click(); });
await new Promise(r=>setTimeout(r,900));
await p.screenshot({path:OUT+'/world-high.png'});
const counts=await p.evaluate(()=>({ paint: window.__aac3dPaint? window.__aac3dPaint():null }));
console.log(JSON.stringify(counts));
await b.close(); srv.close();
