/* SHOOT SALVAGE. A visual change is not done until somebody has LOOKED at it, and a green
 * headless suite is not looking. Drives a real round to each moment that matters and writes a
 * JPEG, at a real phone size, from where the player actually stands.
 *   node salvageshots.js ../index.html <outDir> [W H]
 */
const fs=require('fs'), path=require('path'), {JSDOM}=require('jsdom');
const napi=require('@napi-rs/canvas');
const htmlPath=process.argv[2]||'/workspaces/abduct_a_chameleon/index.html';
const outDir=process.argv[3]||'/tmp/aac-salv';
const W=parseInt(process.argv[4]||'390',10), H=parseInt(process.argv[5]||'740',10), DPR=parseInt(process.argv[6]||'1',10);
fs.mkdirSync(outDir,{recursive:true});
const html=fs.readFileSync(htmlPath,'utf8');
const errors=[], rafQueue=[]; let rafId=1, VT=1000;

function bp(window){
  const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true,helpAutoShown:true,tourDone:true,perf:'smooth',controlsSeen:true})};
  try{ Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},
    clear:()=>{},key:i=>Object.keys(_ls)[i]||null,get length(){return Object.keys(_ls).length;}}}); }catch(_){}
  window.__napi=napi;
  window.HTMLCanvasElement.prototype.getContext=function(){ if(!this.__napi) this.__napi=napi.createCanvas(W*DPR,H*DPR); return this.__napi.getContext('2d'); };
  window.HTMLCanvasElement.prototype.toDataURL=()=>'data:image/png;base64,';
  window.OffscreenCanvas=function(w,h){ return napi.createCanvas(Math.max(1,w|0),Math.max(1,h|0)); };
  const oc=window.document.createElement.bind(window.document);
  window.document.createElement=function(t){ if(String(t).toLowerCase()==='canvas') return napi.createCanvas(300,150); return oc(t); };
  window.requestAnimationFrame=cb=>{rafQueue.push(cb);return rafId++;}; window.cancelAnimationFrame=()=>{};
  const A=class{constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}
    createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createOscillator(){return{type:'',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},start(){},stop(){}};}
    createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}};}
    createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}
    createBufferSource(){return{connect(){},start(){},stop(){}};}
    createDynamicsCompressor(){return{connect(){},threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}};}
    resume(){return Promise.resolve();}};
  window.AudioContext=A; window.webkitAudioContext=A;
  window.matchMedia=q=>({matches:/min-width|fine/.test(q),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  window.navigator.getGamepads=()=>[];
  Object.defineProperty(window,'devicePixelRatio',{value:DPR,configurable:true});
  Object.defineProperty(window,'innerWidth',{value:W,configurable:true});
  Object.defineProperty(window,'innerHeight',{value:H,configurable:true});
  window.Element.prototype.setPointerCapture=function(){}; window.Element.prototype.releasePointerCapture=function(){};
  window.fetch=(url)=>{ try{ const u=String(url).replace(/^\.?\//,''); const p=path.resolve(path.dirname(htmlPath),u);
    if(fs.existsSync(p)){ const b=fs.readFileSync(p,'utf8'); return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(b)),text:()=>Promise.resolve(b)}); } }catch(_){}
    return Promise.resolve({ok:false,json:()=>Promise.reject(0),text:()=>Promise.resolve('')}); };
  window.addEventListener('error',e=>errors.push('ERR '+(e.error&&e.error.stack||e.message)));
}
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'http://localhost:8000/index.html',beforeParse:bp});
const {window}=dom, doc=window.document;
let _t0=Date.now();
const pump=n=>{for(let i=0;i<n;i++){VT+=16.7;const cbs=rafQueue.splice(0,rafQueue.length);for(const cb of cbs){try{cb(VT);}catch(e){ if(!errors.length) console.log('FIRST RAF ERROR:', (e&&e.stack||e)+''); errors.push('raf '+(e&&e.message||e)); }}}};
const key=c=>{for(const t of['keydown','keyup'])doc.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code:c,key:c}));};
const S=()=>{try{return window.__aac.state;}catch(_){return{};}};
const T=()=>window.__aac.t;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function mark(m){ console.log('   .. '+m+'  +'+((Date.now()-_t0)/1000).toFixed(1)+'s'); }
function shot(name){ const cv=doc.getElementById('game'); if(!cv||!cv.__napi) return;
  const p=path.join(outDir,name+'.jpg');
  let b; try{ b=cv.__napi.toBuffer('image/jpeg',88); }catch(_){ b=cv.__napi.toBuffer('image/png'); }
  fs.writeFileSync(p,b); console.log('  shot',name, S().appState+'/'+(S().roundState||''), b.length+'b'); }

(async()=>{
  /* The headless canvas leaks ~17MB of native memory per RENDERED frame and stalls the process
     around frame 155, which is fewer frames than the 3 second countdown. So: render as little
     as possible. Boot, skip the countdown, and advance the SIM (which costs nothing) to reach
     each moment, only pumping real frames when there is a picture to take. */
  const SIM=(n)=>{ try{ window.__aac.t.sim(n); }catch(_){ } };
  /* The camera lives in frame(), not in stepSim, so a teleport with the render skipped leaves
     the view thousands of pixels behind: shot 05 was a picture of empty grass where the rig
     should have been. Snap it, every time, or the shot is a lie about where the player is. */
  const GO=(x,y)=>{ T().teleport(x,y); try{ window.__aac.t.snapCam(); }catch(_){} };
  await wait(200); pump(20);
  key('Enter'); pump(4);
  for(let i=0;i<6;i++){ key('ArrowDown'); pump(1); }
  key('Enter'); pump(4);
  key('Enter'); await wait(120); pump(8);
  key('Enter'); await wait(140); pump(10);
  try{ window.__aac.t.skipCountdown(); }catch(_){}
  SIM(30); pump(6);
  console.log('state:', S().roundState, JSON.stringify(S().salv&&{cores:S().salv.cores,rig:S().salv.rig}));
  shot('01-round-start');

  // a core ahead of you on the ground
  const c=S().salv.corePos.find(x=>!x.taken);
  GO(c.x-84, c.y); SIM(40); key('KeyQ'); SIM(50); pump(6);
  shot('02-core-in-view');

  // mid-pry: the glow and the progress ring
  const holdAt=(x,y,n)=>{ for(let i=0;i<n;i++){ T().teleport(x,y); SIM(1); } try{ window.__aac.t.snapCam(); }catch(_){} };
  holdAt(c.x,c.y,70); pump(6);
  shot('03-prying');
  holdAt(c.x,c.y,200); pump(6);
  shot('04-core-in-hand');

  // the rig, and a delivery
  const r=S().salv.rig;
  GO(r.x, r.y+78); SIM(20); pump(6);
  shot('05-the-rig');
  holdAt(r.x,r.y,20); pump(6);
  shot('06-delivered');

  /* Endgame staging: park the fleet in a corner while the rig is filled. Not a claim that a
     real round is that easy - salvage.js proves the loop under pressure - just a way to reach
     the cutter for a picture without playing four flawless minutes. */
  const parkFleet=()=>{ const st2=S(); for(let i=0;i<st2.ufos;i++) T().moveUfo(i,40,40); };
  for(let n=0;n<8 && !S().salv.cutter;n++){
    parkFleet();
    const cc=S().salv.corePos.find(x=>!x.taken); if(!cc) break;
    holdAt(cc.x,cc.y,420); parkFleet();
    holdAt(r.x,r.y,20); parkFleet();
  }
  SIM(10); pump(6);
  shot('07-cutter-online');
  const p=S().playerPos; T().moveUfo(0, p.x+96, p.y-46); SIM(3); pump(6);
  shot('08-target-in-range');
  key('KeyG');
  for(let i=0;i<70;i++){ const pp=S().playerPos; T().moveUfo(0, pp.x+96, pp.y-46); SIM(1); }
  pump(6);
  shot('09-firing');
  for(let i=0;i<400;i++){ const q=S(); if(q.appState==='SUMMARY') break;
    if(q.roundState==='PLAYING'){ const pp=q.playerPos; T().moveUfo(0, pp.x+96, pp.y-46); }
    SIM(1); if(S().appState!=='ROUND') break; }
  pump(30);
  shot('10-summary');
  console.log('errors:', errors.length, errors.slice(0,3), 'rss='+Math.round(process.memoryUsage().rss/1048576)+'MB');
  process.exit(0);
})();
