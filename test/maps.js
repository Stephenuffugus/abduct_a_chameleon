// P11 map integration: start a Practice round on EVERY level in the manifest (unlocks pre-seeded),
// pump real frames, assert PLAYING with UFOs + zero runtime errors, then quit and try the next.
//   node maps.js [../index.html]
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const htmlPath=process.argv[2]||path.resolve(__dirname,'../index.html');
const html=fs.readFileSync(htmlPath,'utf8');
const errors=[]; const rafQueue=[]; let rafId=1; let VT=1000;
function stubCtx(){const noop=()=>{};return new Proxy({},{get(_t,p){if(p==='canvas')return{width:1280,height:720};if(p==='measureText')return()=>({width:10});if(p==='getImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4))});if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern')return()=>({addColorStop:noop});if(p==='createImageData')return(w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4)),width:w|0,height:h|0});return typeof p==='string'?noop:undefined;},set(){return true;}});}
function bp(window){
  const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true, perf:'smooth'}),
             'aac.progress.v1':JSON.stringify({unlocks:['default','stand','wave','crouch'],equipped:{skin:'default'},stats:{plays:0,catches:0,bestSurvive:0,hardWin:0,heatBest:0},blendbook:{},biomeMedals:{},xp:1000000,challenges:{}})};   // xp maxed → every map unlocked
  try{ Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{for(const k in _ls)delete _ls[k];},key:i=>Object.keys(_ls)[i]||null,get length(){return Object.keys(_ls).length;}}}); }catch(_){}
  window.HTMLCanvasElement.prototype.getContext=()=>stubCtx();window.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return stubCtx();}};window.requestAnimationFrame=cb=>{rafQueue.push(cb);return rafId++;};window.cancelAnimationFrame=()=>{};
  const A=class{constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){return{type:'',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}};}createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}};}createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}createBufferSource(){return{connect(){},start(){},stop(){}};}resume(){return Promise.resolve();}};
  window.AudioContext=A;window.webkitAudioContext=A;window.matchMedia=q=>({matches:/min-width|fine/.test(q),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});window.navigator.getGamepads=()=>[];Object.defineProperty(window,'devicePixelRatio',{value:2,configurable:true});window.Element.prototype.setPointerCapture=function(){};window.Element.prototype.releasePointerCapture=function(){};
  window.fetch=(url)=>{try{let u=String(url).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');const p=path.resolve(path.dirname(htmlPath),u);if(fs.existsSync(p)){const b=fs.readFileSync(p,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(b)),text:()=>Promise.resolve(b)});}}catch(_){}return Promise.resolve({ok:false,json:()=>Promise.reject(0),text:()=>Promise.resolve('')});};
  window.addEventListener('error',e=>errors.push('ERR '+(e.error&&e.error.stack||e.message)));window.addEventListener('unhandledrejection',e=>errors.push('REJ '+(e.reason&&e.reason.stack||e.reason)));
}
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'http://localhost:8000/index.html',beforeParse:bp});
const {window}=dom;
function pump(n){for(let i=0;i<n;i++){VT+=16.7;const cbs=rafQueue.splice(0,rafQueue.length);for(const cb of cbs){try{cb(VT);}catch(e){errors.push('raf '+(e&&e.stack||e));}}}}
function key(code){for(const t of['keydown','keyup']){window.document.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code,key:code}));}}
const S=()=>{try{return window.__aac.state;}catch(_){return{};}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(n,c,x='')=>{ console.log(`${c?'OK  ':'FAIL'}  ${n}${x?'  — '+x:''}`); if(!c) fails++; };
(async()=>{
 await wait(200); pump(20);
 const manifest=JSON.parse(fs.readFileSync(path.resolve(path.dirname(htmlPath),'maps/levels.json'),'utf8'));
 const total=S().levels;
 ok(`manifest loaded (${manifest.length} maps + baked)`, total===manifest.length+1, 'levels='+total+' manifest='+manifest.length);
 for(let i=0;i<total;i++){
   // TITLE → MODE_SELECT → Practice → LEVEL_SELECT
   key('Enter'); pump(6); key('Enter'); pump(6);
   for(let k=0;k<i;k++){ key('ArrowRight'); pump(1); }
   const e0=errors.length;
   key('Enter'); await wait(80); pump(10); pump(200);   // select level i, countdown → PLAYING
   const st=S();
   const okRound = st.appState==='ROUND' && st.roundState==='PLAYING' && st.ufos>=1 && st.terrain;
   ok(`map ${i+1}/${total} plays  (${st.terrain}, ${st.ufos} ufo)`, okRound && errors.length===e0,
      `rs=${st.roundState} errs=${errors.length-e0}`);
   // quit: Esc → pause, ArrowUp wraps to 'Quit to Menu', Enter → TITLE
   key('Escape'); pump(4); key('ArrowUp'); pump(2); key('Enter'); pump(8);
   if(S().appState!=='TITLE'){ key('Escape'); pump(4); }   // safety
 }
 // big-map pressure: Survive EASY on a >=4800-cell expansion map fields UFO_COUNT+1 hunters
 { key('Enter'); pump(6);                        // TITLE → MODE_SELECT
   key('ArrowDown'); pump(2); key('Enter'); pump(6);     // Survive → LEVEL_SELECT
   pump(2);
   const big=(S().levelOrder||[]).indexOf('frostharbor');   // display order is region-grouped (P17)
   if(big>=0){
     for(let k=0;k<big;k++){ key('ArrowRight'); pump(1); }
     key('Enter'); await wait(80); pump(10);      // → DIFFICULTY_SELECT (menuIndex=1)
     key('ArrowUp'); pump(2); key('Enter'); await wait(60); pump(220);   // EASY → PLAYING
     ok('big-map Survive fields an extra hunter (EASY 1→2)', S().roundState==='PLAYING' && S().ufos===2, 'ufos='+S().ufos+' rs='+S().roundState);
     // P19: frostharbor is tundra — hunters sweep faster with slightly shorter vision (EASY SCAN_R 144→135)
     ok('region hunting style applied (tundra tuning)', S().region && S().region.tuned==='tundra' && S().region.scanR===135,
        JSON.stringify(S().region));
   } else ok('big-map pressure check (frostharbor present)', false, 'frostharbor missing from manifest'); }
 if(errors.length){ console.log('ERRORS:'); [...new Set(errors)].slice(0,8).forEach(e=>console.log('  • '+e.split('\n').slice(0,2).join(' '))); fails+=errors.length; }
 console.log(fails? `\nMAPS: FAIL (${fails})` : `\nMAPS: PASS — all ${total} levels boot into PLAYING with hunters (+1 on big ground); 0 errors`);
 process.exit(fails?1:0);
})();
