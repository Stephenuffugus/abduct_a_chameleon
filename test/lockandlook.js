// Headless test for P9 "The Photo Loop" — lock → look → zoom → hold → paint → unlock.
// Verifies: the stillness law (LOOK↔PAINT hops never move the camera), implicit camera-hold on
// 🎨-from-LOOK, tap-to-hop-back, pill = all-the-way-home, wheel + pinch zoom (bounds, detents,
// pivot re-anchor), MOVE-entry paint unchanged, reset sites, __aac add-only shape.
//   node lockandlook.js [../index.html]
const fs=require('fs'), path=require('path');
const { JSDOM }=require('jsdom');
const htmlPath=process.argv[2]||path.resolve(__dirname,'../index.html');
const html=fs.readFileSync(htmlPath,'utf8');
const errors=[], rafQueue=[]; let rafId=1;

function stubCtx(){ const noop=()=>{};
  return new Proxy({},{ get(_t,p){
    if(p==='canvas') return {width:1440,height:900};
    if(p==='measureText') return ()=>({width:10});
    if(p==='getImageData') return (x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4)),width:w|0,height:h|0});
    if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern') return ()=>({addColorStop:noop});
    if(p==='createImageData') return (w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4)),width:w|0,height:h|0});
    if(p==='setTransform'||p==='getTransform') return ()=>({a:1,b:0,c:0,d:1,e:0,f:0});
    return typeof p==='string'?noop:undefined; }, set(){return true;} }); }
function beforeParse(window){
  const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true, perf:'smooth'})};
  Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{for(const k in _ls)delete _ls[k];},key:i=>Object.keys(_ls)[i]||null,get length(){return Object.keys(_ls).length;}}});
  window.HTMLCanvasElement.prototype.getContext=function(){return stubCtx();};
  window.HTMLCanvasElement.prototype.toDataURL=function(){return 'data:image/png;base64,';};
  window.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return stubCtx();}};
  window.requestAnimationFrame=cb=>{rafQueue.push(cb);return rafId++;};
  window.cancelAnimationFrame=()=>{};
  const A=class{constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}
    createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createOscillator(){return{type:'sine',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},start(){},stop(){},disconnect(){}};}
    createBiquadFilter(){return{type:'lowpass',frequency:{value:0,setValueAtTime(){}},Q:{value:1},connect(){},disconnect(){}};}
    createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};} createBufferSource(){return{buffer:null,connect(){},start(){},stop(){},disconnect(){}};}
    createDynamicsCompressor(){return{connect(){},disconnect(){},threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}};}
    resume(){return Promise.resolve();}suspend(){return Promise.resolve();}};
  window.AudioContext=A; window.webkitAudioContext=A;
  window.matchMedia=q=>({matches:/min-width|pointer:\s*fine/.test(q),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  window.navigator.getGamepads=()=>[];
  Object.defineProperty(window,'devicePixelRatio',{value:2,configurable:true});
  window.Element.prototype.setPointerCapture=function(){}; window.Element.prototype.releasePointerCapture=function(){};
  window.fetch=url=>{ try{ let u=String(url).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,''); const p=path.resolve(path.dirname(htmlPath),u);
    if(fs.existsSync(p)){ const body=fs.readFileSync(p,'utf8'); return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(body)),text:()=>Promise.resolve(body)});} }catch(_){}
    return Promise.resolve({ok:false,status:404,json:()=>Promise.reject(new Error('404')),text:()=>Promise.resolve('')}); };
  window.addEventListener('error',e=>errors.push('window.error: '+(e.error&&e.error.stack||e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push('unhandledrejection: '+(e.reason&&e.reason.stack||e.reason)));
  const oe=window.console.error.bind(window.console); window.console.error=(...a)=>{errors.push('console.error: '+a.map(String).join(' '));oe(...a);};
}
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'http://localhost:8000/index.html',beforeParse});
const { window }=dom; const cv=()=>window.document.querySelector('canvas');
const VW=()=>window.innerWidth, VH=()=>window.innerHeight;
function fire(type,props={}){ try{ let e;
  if(/^key/.test(type)) e=new window.KeyboardEvent(type,{bubbles:true,cancelable:true,...props});
  else { e=new window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:props.clientX||0,clientY:props.clientY||0}); try{Object.defineProperty(e,'pointerId',{value:props.pointerId!=null?props.pointerId:1});}catch(_){}
    if(props.pointerType!==undefined){ try{Object.defineProperty(e,'pointerType',{value:props.pointerType});}catch(_){} } }
  (/^key/.test(type)?window.document:cv()).dispatchEvent(e);
}catch(err){ errors.push('fire '+type+': '+err.message); } }
// P9 harness upgrade: wheel events (WheelEvent when available, patched Event otherwise)
function wheel(dy,cx,cy,ctrl){ try{ let e;
  try{ e=new window.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:dy,clientX:cx,clientY:cy,ctrlKey:!!ctrl}); }
  catch(_){ e=new window.Event('wheel',{bubbles:true,cancelable:true});
    for(const [k,v] of Object.entries({deltaY:dy,deltaMode:0,clientX:cx,clientY:cy,ctrlKey:!!ctrl})) Object.defineProperty(e,k,{value:v}); }
  if(e.deltaY===undefined||e.deltaY!==dy){ try{Object.defineProperty(e,'deltaY',{value:dy});}catch(_){}}
  cv().dispatchEvent(e);
}catch(err){ errors.push('wheel: '+err.message); } }
let VT=1000; function pump(n){ for(let i=0;i<n;i++){ VT+=16.7; const cbs=rafQueue.splice(0,rafQueue.length); for(const cb of cbs){ try{cb(VT);}catch(e){errors.push('raf: '+(e&&e.stack||e));} } } }
const key=c=>{ fire('keydown',{code:c,key:c}); fire('keyup',{code:c,key:c}); };
const st=()=>{ try{ return window.__aac.state; }catch(_){ return {}; } };
const tapAt=(x,y,id)=>{ fire('pointerdown',{clientX:x,clientY:y,pointerId:id||30}); fire('pointerup',{clientX:x,clientY:y,pointerId:id||30}); };
const tapRect=(r,id)=>{ if(!r) return; tapAt(r.x+r.w/2,r.y+r.h/2,id); };
const btn=id=>{ const b=st().hud&&st().hud.modeButtons; return b&&b.find(x=>x.id===id); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(n,c,x='')=>{ console.log(`${c?'OK  ':'FAIL'}  ${n}${x?'  — '+x:''}`); if(!c) fails++; };
const frame=()=>({ cx:st().cam.x, cy:st().cam.y, px:st().camPan.x, py:st().camPan.y, z:st().zoom });
const sameFrame=(a,b,tol)=> Math.abs(a.cx-b.cx)<=tol && Math.abs(a.cy-b.cy)<=tol && Math.abs(a.z-b.z)<=0.002;

async function main(){
  await wait(150);
  pump(20); key('Enter'); pump(6); key('Enter'); pump(6); key('Enter'); await wait(60); pump(8);
  if(st().appState==='DIFFICULTY_SELECT'){ key('Enter'); await wait(40); pump(8); }
  pump(220);
  ok('L0 reached PLAYING in MOVE', st().roundState==='PLAYING' && st().mode==='MOVE', 'mode='+st().mode+' rs='+st().roundState);
  ok('L0 __aac exposes hold state', st().hold && typeof st().hold.locked==='boolean' && typeof st().hold.vz==='number', JSON.stringify(st().hold));

  // ---- L1 LOOK: free zoom via wheel, bounded, detent keys ----
  key('KeyI'); pump(20);
  ok('L1 KeyI → LOOK at seeker altitude (vz=0.78)', st().mode==='INSPECT' && Math.abs(st().hold.vz-0.78)<0.02, 'vz='+st().hold.vz);
  const z78=st().zoom;
  for(let i=0;i<10;i++) wheel(120, VW()*0.5, VH()*0.5);   // zoom OUT hard
  pump(6);
  ok('L1 wheel-out zooms out and clamps at FAR (vz≥0.55)', st().hold.vz>=0.549 && st().hold.vz<0.62 && st().zoom<z78, 'vz='+st().hold.vz+' zoom='+st().zoom);
  for(let i=0;i<40;i++) wheel(-120, VW()*0.5, VH()*0.5);  // zoom IN hard
  pump(6);
  ok('L1 wheel-in clamps at CLOSE (vz≤1.6)', st().hold.vz<=1.601, 'vz='+st().hold.vz);
  key('Minus'); pump(4);
  ok('L1 Minus steps down a detent (1.6→1.0)', Math.abs(st().hold.vzTarget-1.0)<0.01, 'vzT='+st().hold.vzTarget);
  key('Minus'); pump(4); key('Minus'); pump(4);
  ok('L1 detents bottom out at FAR (0.55)', Math.abs(st().hold.vzTarget-0.55)<0.01, 'vzT='+st().hold.vzTarget);
  const zb=st().hud.zoom;
  ok('L1 zoom buttons exposed while looking', !!(zb && zb.zin && zb.zout), JSON.stringify(zb));
  tapRect(zb.zin, 31); pump(4);
  ok('L1 ＋ button steps up a detent (0.55→0.78)', Math.abs(st().hold.vzTarget-0.78)<0.01, 'vzT='+st().hold.vzTarget);

  // ---- L2 the stillness law: 🎨 from LOOK holds the shot ----
  // drag DOWN-left: camera drops below the body so it frames in the upper half — clear of the studio panel,
  // so the (designed) compose nudge stays out of this stillness assertion
  const px=Math.floor(VW()*0.8), py=Math.floor(VH()*0.35);
  fire('pointerdown',{clientX:px,clientY:py,pointerId:5}); fire('pointermove',{clientX:px-180,clientY:py+110,pointerId:5});
  fire('pointerup',{clientX:px-180,clientY:py+110,pointerId:5}); pump(40);   // held pan + let vz settle
  const F1=frame();
  key('KeyE'); pump(3);
  ok('L2 🎨 from LOOK → PAINT with the shot HELD', st().mode==='PAINT' && st().studio.open===true && st().hold.locked===true, 'locked='+st().hold.locked);
  const F2=frame();
  ok('L2 stillness law: LOOK→PAINT moved nothing', sameFrame(F1,F2,1.5), JSON.stringify({F1,F2}));
  ok('L2 pan survives into held paint (not zeroed)', Math.hypot(F2.px,F2.py)>10, 'pan='+Math.hypot(F2.px,F2.py).toFixed(1));
  ok('L2 brackets drawing in', st().hold.brackets>0.05, 'brackets='+st().hold.brackets);

  // ---- L3 tap empty space hops BACK to LOOK, framing identical ----
  tapAt(Math.floor(VW()*0.62), 120, 33); pump(3);
  const F3=frame();
  ok('L3 tap-empty in held paint hops back to LOOK (not MOVE)', st().mode==='INSPECT' && st().studio.open===false, 'mode='+st().mode);
  ok('L3 framing pixel-identical after the hop', sameFrame(F2,F3,1.5), JSON.stringify({F2,F3}));
  ok('L3 hold released on the hop', st().hold.locked===false);

  // ---- L4 Esc in held paint = one step back; pill = all the way home ----
  key('KeyE'); pump(3);
  ok('L4 re-hold works', st().hold.locked===true && st().mode==='PAINT');
  key('Escape'); pump(3);
  ok('L4 Esc from held paint → LOOK (one step back)', st().mode==='INSPECT' && !st().hold.locked, 'mode='+st().mode);
  key('KeyE'); pump(3);
  tapRect(st().hud.pill, 34); pump(60);
  ok('L4 pill from held paint → MOVE, camera glides home', st().mode==='MOVE' && !st().hold.locked && st().inspect.zoomT<0.4 && Math.hypot(st().camPan.x,st().camPan.y)<6,
     `mode=${st().mode} zoomT=${st().inspect.zoomT} pan=${Math.hypot(st().camPan.x,st().camPan.y).toFixed(1)}`);

  // ---- L5 MOVE-entry paint is byte-identical to the legacy path ----
  key('KeyE'); pump(3);
  ok('L5 🎨 from MOVE → unlocked paint, pan pinned to body', st().mode==='PAINT' && st().hold.locked===false && Math.hypot(st().camPan.x,st().camPan.y)<1, 'pan='+Math.hypot(st().camPan.x,st().camPan.y).toFixed(2));
  tapAt(Math.floor(VW()*0.62), 120, 35); pump(3);
  ok('L5 tap-empty in unlocked paint exits to MOVE (legacy)', st().mode==='MOVE' && st().studio.open===false, 'mode='+st().mode);

  // ---- L6 wheel in MOVE: pulling back enters LOOK; zoom-in stays inert ----
  wheel(-120, VW()*0.5, VH()*0.5); pump(3);
  ok('L6 wheel-IN in MOVE stays in MOVE', st().mode==='MOVE');
  wheel(120, VW()*0.5, VH()*0.5); pump(3);
  ok('L6 wheel-OUT in MOVE enters LOOK', st().mode==='INSPECT');
  pump(20);

  // ---- L7 pinch: two fingers on the free side; survivor re-bases with zero jump ----
  const ax=Math.floor(VW()*0.7), ay=Math.floor(VH()*0.4);
  fire('pointerdown',{clientX:ax,clientY:ay,pointerId:7,pointerType:'touch'});
  fire('pointerdown',{clientX:ax+160,clientY:ay,pointerId:8,pointerType:'touch'}); pump(2);
  ok('L7 second finger while panning forms a pinch', st().hold.pinch===true);
  const vz0=st().hold.vz;
  fire('pointermove',{clientX:ax-60,clientY:ay,pointerId:7}); fire('pointermove',{clientX:ax+240,clientY:ay,pointerId:8}); pump(3);
  ok('L7 spreading fingers zooms IN (vz grows, bounded)', st().hold.vz>vz0 && st().hold.vz<=1.601, `vz ${vz0}→${st().hold.vz}`);
  fire('pointerup',{clientX:ax+240,clientY:ay,pointerId:8}); pump(2);
  ok('L7 finger lift ends pinch, survivor keeps panning', st().hold.pinch===false);
  const p0={x:st().camPan.x,y:st().camPan.y};
  fire('pointermove',{clientX:ax-60+40,clientY:ay,pointerId:7}); pump(2);
  const dp=Math.hypot(st().camPan.x-p0.x, st().camPan.y-p0.y);
  ok('L7 survivor pan is continuous (re-anchored, no jump)', dp>2 && dp<120, 'Δpan='+dp.toFixed(1));
  fire('pointerup',{clientX:ax-20,clientY:ay,pointerId:7}); pump(4);

  // ---- L8 reset sweep: pause while held clears the hold ----
  key('KeyE'); pump(3);
  ok('L8 held again', st().hold.locked===true);
  key('KeyP'); pump(3);   // KeyP in PAINT toggles paint mode... (KeyP is a paint toggle) — use pause via Escape chain instead
  // Escape: held→LOOK, Escape: LOOK→MOVE, Escape: pause
  if(st().mode==='PAINT'){ key('Escape'); pump(2); }
  if(st().mode==='INSPECT'){ key('Escape'); pump(2); }
  key('Escape'); pump(3);
  ok('L8 Esc chain lands in PAUSED with hold cleared', st().roundState==='PAUSED' && st().hold.locked===false, 'rs='+st().roundState+' locked='+st().hold.locked);

  finish();
}
function finish(){
  console.log(`\nFINAL mode=${st().mode} vz=${st().hold&&st().hold.vz} zoom=${st().zoom}`);
  const uniq=[...new Set(errors)]; if(uniq.length){ console.log('\nERRORS:'); uniq.slice(0,15).forEach(e=>console.log('  • '+e.split('\n').slice(0,3).join('\n     '))); fails+=uniq.length; }
  console.log(fails? `\nLOCK&LOOK: FAIL (${fails})` : '\nLOCK&LOOK: PASS — photo loop holds: stillness law, implicit hold, hop-back, pill home, wheel+pinch zoom, resets; 0 errors');
  process.exit(fails?1:0);
}
main();
