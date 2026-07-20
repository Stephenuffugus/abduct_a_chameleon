// P12 progression test: a real Survive round (into an abduction → SUMMARY) must award XP,
// expose xp/level/challenges via __aac, and persist through PROGRESS.
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const htmlPath=process.argv[2]||path.resolve(__dirname,'../index.html');
const html=fs.readFileSync(htmlPath,'utf8');
const errors=[]; const rafQueue=[]; let rafId=1; let VT=1000;
function stubCtx(){const noop=()=>{};return new Proxy({},{get(_t,p){if(p==='canvas')return{width:1280,height:720};if(p==='measureText')return()=>({width:10});if(p==='getImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4))});if(p==='createLinearGradient'||p==='createRadialGradient')return()=>({addColorStop:noop});return typeof p==='string'?noop:undefined;},set(){return true;}});}
// trail pre-equipped so the P16 emission path runs during the round (any crash fails the suite)
const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true, tourDone:true}),
           'aac.progress.v1':JSON.stringify({unlocks:['default','stand','wave','crouch','trail_bubbles'],
             equipped:{skin:'default',trail:'trail_bubbles'},stats:{plays:0,catches:0,bestSurvive:0,hardWin:0,heatBest:0},
             blendbook:{},biomeMedals:{},xp:0,challenges:{}})};
function bp(window){
  try{ Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{for(const k in _ls)delete _ls[k];},key:i=>Object.keys(_ls)[i]||null,get length(){return Object.keys(_ls).length;}}}); }catch(_){}
window.HTMLCanvasElement.prototype.getContext=()=>stubCtx();window.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return stubCtx();}};window.requestAnimationFrame=cb=>{rafQueue.push(cb);return rafId++;};window.cancelAnimationFrame=()=>{};const A=class{constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){return{type:'',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}};}createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}};}createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}createBufferSource(){return{connect(){},start(){},stop(){}};}resume(){return Promise.resolve();}};window.AudioContext=A;window.webkitAudioContext=A;window.matchMedia=q=>({matches:/min-width|fine/.test(q),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});window.navigator.getGamepads=()=>[];Object.defineProperty(window,'devicePixelRatio',{value:2,configurable:true});window.Element.prototype.setPointerCapture=function(){};window.Element.prototype.releasePointerCapture=function(){};window.fetch=(url)=>{try{let u=String(url).replace(/^\.?\//,'');const p=path.resolve(path.dirname(htmlPath),u);if(fs.existsSync(p)){const b=fs.readFileSync(p,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(b)),text:()=>Promise.resolve(b)});}}catch(_){}return Promise.resolve({ok:false,json:()=>Promise.reject(0),text:()=>Promise.resolve('')});};window.addEventListener('error',e=>errors.push('ERR '+(e.error&&e.error.stack||e.message)));window.addEventListener('unhandledrejection',e=>errors.push('REJ '+(e.reason&&e.reason.stack||e.reason)));}
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'http://localhost:8000/index.html',beforeParse:bp});
const {window}=dom;
function pump(n){for(let i=0;i<n;i++){VT+=16.7;const cbs=rafQueue.splice(0,rafQueue.length);for(const cb of cbs){try{cb(VT);}catch(e){errors.push('raf '+(e&&e.stack||e));}}}}
function key(code){for(const t of['keydown','keyup']){window.document.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code,key:code}));}}
function down(code){window.document.dispatchEvent(new window.KeyboardEvent('keydown',{bubbles:true,cancelable:true,code,key:code}));}
function up(code){window.document.dispatchEvent(new window.KeyboardEvent('keyup',{bubbles:true,cancelable:true,code,key:code}));}
const S=()=>{try{return window.__aac.state;}catch(_){return{};}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(n,c,x='')=>{ console.log(`${c?'OK  ':'FAIL'}  ${n}${x?'  — '+x:''}`); if(!c) fails++; };
(async()=>{
 await wait(150); pump(20);
 ok('P12 __aac exposes xp/level/challenges', typeof S().progress.xp==='number' && typeof S().progress.level==='number' && !!S().progress.challenges,
    JSON.stringify({xp:S().progress.xp, level:S().progress.level}));
 key('Enter'); pump(6);
 key('ArrowDown'); pump(4);
 key('Enter'); pump(6);
 key('Enter'); await wait(60); pump(8);
 key('ArrowUp'); pump(4); key('Enter'); await wait(30); pump(10);
 pump(220);
 let reachedSummary=false;
 for(let seg=0; seg<400 && !reachedSummary; seg++){
   const st=S(); if(!st.ufoPos||!st.ufoPos.length) break;
   const pp=st.playerPos; let best=st.ufoPos[0],bd=1e9;
   for(const u of st.ufoPos){const d=(u.x-pp.x)**2+(u.y-pp.y)**2; if(d<bd){bd=d;best=u;}}
   const dx=best.x-pp.x, dy=best.y-pp.y;
   const hk = Math.abs(dx)>8 ? (dx>0?'KeyD':'KeyA') : null;
   const vk = Math.abs(dy)>8 ? (dy>0?'KeyS':'KeyW') : null;
   if(hk) down(hk); if(vk) down(vk);
   pump(8);
   if(hk) up(hk); if(vk) up(vk);
   if(S().appState==='SUMMARY') reachedSummary=true;
 }
 pump(160);
 const fin=S();
 ok('P12 reached SUMMARY', fin.appState==='SUMMARY', 'appState='+fin.appState);
 ok('P12 summary carries earned XP', fin.summary && fin.summary.xp>0, 'xp='+(fin.summary&&fin.summary.xp));
 ok('P12 PROGRESS.xp accrued', fin.progress.xp>0 && fin.progress.xp===((fin.summary&&fin.summary.xp)||0), 'progress.xp='+fin.progress.xp);
 const expLvl=(xp)=>{ let L=1; while(xp>=75*L*(L+1) && L<999) L++; return L; };   // mirror of xpLevel — consistency, not vacuity
 ok('P12 level consistent with the curve', fin.progress.level===expLvl(fin.progress.xp), 'level='+fin.progress.level+' xp='+fin.progress.xp);
 const stored=JSON.parse(_ls['aac.progress.v1']||'{}');
 ok('P12 xp persisted to localStorage', stored.xp===fin.progress.xp, 'stored.xp='+stored.xp);
 if(errors.length){ console.log('ERRORS:', errors.slice(0,6)); fails+=errors.length; }
 console.log(fails? `\nPROGRESSION: FAIL (${fails})` : '\nPROGRESSION: PASS — XP awarded, leveled, persisted; 0 errors');
 process.exit(fails?1:0);
})();
