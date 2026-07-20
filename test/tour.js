// P14 "First Flight" guided tour: activates on the first Practice round, advances by DOING
// (sneak → look → zoom → hold+match → melt in), completes, persists tourDone, never returns.
//   node tour.js [../index.html]
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const htmlPath=process.argv[2]||path.resolve(__dirname,'../index.html');
const html=fs.readFileSync(htmlPath,'utf8');
const errors=[]; const rafQueue=[]; let rafId=1; let VT=1000;
function stubCtx(){const noop=()=>{};return new Proxy({},{get(_t,p){if(p==='canvas')return{width:1280,height:720};if(p==='measureText')return()=>({width:10});if(p==='getImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4))});if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern')return()=>({addColorStop:noop});return typeof p==='string'?noop:undefined;},set(){return true;}});}
const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true, perf:'smooth'})};   // tourDone NOT seeded — the tour must fire
function bp(window){
  try{ Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{for(const k in _ls)delete _ls[k];},key:i=>Object.keys(_ls)[i]||null,get length(){return Object.keys(_ls).length;}}}); }catch(_){}
  window.HTMLCanvasElement.prototype.getContext=()=>stubCtx();window.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return stubCtx();}};window.requestAnimationFrame=cb=>{rafQueue.push(cb);return rafId++;};window.cancelAnimationFrame=()=>{};
  const A=class{constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){return{type:'',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}};}createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}};}createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}createBufferSource(){return{connect(){},start(){},stop(){}};}resume(){return Promise.resolve();}};
  window.AudioContext=A;window.webkitAudioContext=A;window.matchMedia=q=>({matches:/min-width|fine/.test(q),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});window.navigator.getGamepads=()=>[];Object.defineProperty(window,'devicePixelRatio',{value:2,configurable:true});window.Element.prototype.setPointerCapture=function(){};window.Element.prototype.releasePointerCapture=function(){};
  window.fetch=(url)=>{try{let u=String(url).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');const p=path.resolve(path.dirname(htmlPath),u);if(fs.existsSync(p)){const b=fs.readFileSync(p,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(b)),text:()=>Promise.resolve(b)});}}catch(_){}return Promise.resolve({ok:false,json:()=>Promise.reject(0),text:()=>Promise.resolve('')});};
  window.addEventListener('error',e=>errors.push('ERR '+(e.error&&e.error.stack||e.message)));window.addEventListener('unhandledrejection',e=>errors.push('REJ '+(e.reason&&e.reason.stack||e.reason)));
}
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'http://localhost:8000/index.html',beforeParse:bp});
const {window}=dom; const cv=()=>window.document.querySelector('canvas');
function pump(n){for(let i=0;i<n;i++){VT+=16.7;const cbs=rafQueue.splice(0,rafQueue.length);for(const cb of cbs){try{cb(VT);}catch(e){errors.push('raf '+(e&&e.stack||e));}}}}
function key(code){for(const t of['keydown','keyup']){window.document.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code,key:code}));}}
function down(code){window.document.dispatchEvent(new window.KeyboardEvent('keydown',{bubbles:true,cancelable:true,code,key:code}));}
function up(code){window.document.dispatchEvent(new window.KeyboardEvent('keyup',{bubbles:true,cancelable:true,code,key:code}));}
function wheel(dy){ try{ let e; try{ e=new window.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:dy,clientX:512,clientY:380}); }
  catch(_){ e=new window.Event('wheel',{bubbles:true,cancelable:true}); for(const [k,v] of Object.entries({deltaY:dy,deltaMode:0,clientX:512,clientY:380})) Object.defineProperty(e,k,{value:v}); }
  cv().dispatchEvent(e); }catch(err){ errors.push('wheel: '+err.message); } }
const S=()=>{try{return window.__aac.state;}catch(_){return{};}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(n,c,x='')=>{ console.log(`${c?'OK  ':'FAIL'}  ${n}${x?'  — '+x:''}`); if(!c) fails++; };
(async()=>{
 await wait(150); pump(20);
 key('Enter'); pump(6); key('Enter'); pump(6); key('Enter'); await wait(60); pump(8); pump(220);
 ok('T0 tour active on first Practice at step 0', S().tour && S().tour.active===true && S().tour.step===0, JSON.stringify(S().tour));
 down('KeyW'); pump(70); up('KeyW'); pump(4);                       // sneak/walk >0.9s
 ok('T1 moving advances to step 1', S().tour.step===1, 'step='+S().tour.step);
 key('KeyI'); pump(50);                                             // look for >0.7s
 ok('T2 looking advances to step 2', S().tour.step===2, 'step='+S().tour.step);
 for(let i=0;i<8;i++) wheel(120); pump(25);                         // zoom well past the detent
 ok('T3 zooming advances to step 3', S().tour.step===3, 'step='+S().tour.step);
 key('KeyE'); pump(4); key('KeyM'); pump(20);                       // hold the shot, MATCH via studio key
 ok('T4 hold+match advances to step 4', S().tour.step===4, 'step='+S().tour.step+' mq='+S().mq);
 key('Escape'); pump(4); key('Escape'); pump(6);                    // back to MOVE, stand still
 pump(400);                                                         // settle → conceal ≥0.85 → done banner → auto-end
 ok('T5 melting in completes the tour', S().tour.active===false, JSON.stringify(S().tour)+' conceal='+S().conceal);
 const stored=JSON.parse(_ls['aac.settings.v1']||'{}');
 ok('T6 tourDone persisted (never returns)', stored.tourDone===true, 'tourDone='+stored.tourDone);
 ok('T7 tour marked the one-shot hints as seen', stored.seenLookHint===true && stored.seenHoldHint===true);
 if(errors.length){ console.log('ERRORS:'); [...new Set(errors)].slice(0,6).forEach(e=>console.log('  • '+e.split('\n').slice(0,2).join(' '))); fails+=errors.length; }
 console.log(fails? `\nTOUR: FAIL (${fails})` : '\nTOUR: PASS — first flight teaches by doing and completes; 0 errors');
 process.exit(fails?1:0);
})();
