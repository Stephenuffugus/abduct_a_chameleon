const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const htmlPath='/workspaces/abduct_a_chameleon/index.html';const html=fs.readFileSync(htmlPath,'utf8');
const errors=[];const rafQueue=[];let VT=1000;
function bp(window){ try{const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true})}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{},key:()=>null,length:1}});}catch(_){}
 window.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get(t,p){if(p==='canvas')return{width:960,height:600};if(p==='measureText')return()=>({width:10});if(p==='getImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4))});if(p==='createLinearGradient'||p==='createRadialGradient')return()=>({addColorStop(){}});return typeof p==='string'?()=>{}:undefined;},set(){return true;}});
 window.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return window.HTMLCanvasElement.prototype.getContext();}};
 window.requestAnimationFrame=cb=>{rafQueue.push(cb);return 1;};window.cancelAnimationFrame=()=>{};
 const A=class{constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){return{type:'',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}};}createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}};}createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}createBufferSource(){return{connect(){},start(){},stop(){}};}resume(){return Promise.resolve();}};
 window.AudioContext=A;window.webkitAudioContext=A;window.matchMedia=q=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
 window.navigator.getGamepads=()=>[];Object.defineProperty(window,'devicePixelRatio',{value:1,configurable:true});Object.defineProperty(window,'innerWidth',{value:960,configurable:true});Object.defineProperty(window,'innerHeight',{value:600,configurable:true});
 window.Element.prototype.setPointerCapture=function(){};window.Element.prototype.releasePointerCapture=function(){};
 window.fetch=u=>{try{let s=String(u).replace(/^\.?\//,'');const p=path.resolve(path.dirname(htmlPath),s);if(fs.existsSync(p)){const b=fs.readFileSync(p,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(b)),text:()=>Promise.resolve(b)});}}catch(_){}return Promise.resolve({ok:false,json:()=>Promise.reject(0),text:()=>Promise.resolve('')});};
 window.addEventListener('error',e=>errors.push('ERR '+(e.error&&e.error.stack||e.message)));}
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'http://localhost:8000/index.html',beforeParse:bp});
const {window}=dom,doc=window.document;
function pump(n){for(let i=0;i<n;i++){VT+=16.7;const cbs=rafQueue.splice(0,rafQueue.length);for(const cb of cbs){try{cb(VT);}catch(e){errors.push('raf '+(e&&e.stack||e));}}}}
function down(c){doc.dispatchEvent(new window.KeyboardEvent('keydown',{bubbles:true,code:c,key:c}));}
function up(c){doc.dispatchEvent(new window.KeyboardEvent('keyup',{bubbles:true,code:c,key:c}));}
function key(c){down(c);up(c);}
const S=()=>window.__aac.state; const L=m=>console.log(m);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ await wait(160);pump(20);key('Enter');pump(6);key('Enter');pump(6);key('Enter');await wait(70);pump(30);pump(200);
 L('PLAYING '+S().roundState+' pos '+JSON.stringify(S().playerPos));
 // FREEZE: hold Space, pump, check freezeCap rises above 0.95
 down('Space'); pump(60); const fc=S().ability.freezeCap; L('FREEZE: freezeCap='+fc+' frozen='+S().ability.freeze+' (expect >0.95, true)'); up('Space');
 // DASH: record pos, dash, check moved
 pump(20); const p0=S().playerPos; key('ControlLeft'); pump(20); const p1=S().playerPos;
 const moved=Math.hypot(p1.x-p0.x,p1.y-p0.y); L('DASH: moved '+moved.toFixed(0)+'px dashCd='+S().ability.dashCd+' (expect >20, cd>0)');
 // DECOY
 key('KeyC'); pump(4); L('DECOY: decoys='+S().decoys+' decoyCd='+S().ability.decoyCd+' (expect 1, cd>0)');
 // INK
 key('KeyV'); pump(4); L('INK: inks='+S().inks+' inkCd='+S().ability.inkCd+' (expect 1, cd>0)');
 // pose cycle
 key('KeyR'); pump(2); L('POSE: '+S().pose);
 pump(120); L('after 2s: decoys='+S().decoys+' inks='+S().inks+' (decay over time)');
 L('errors='+errors.length+(errors.length?' '+errors.slice(0,3).join('|'):'')); process.exit(errors.length?1:0);
})().catch(e=>{L('CAUGHT '+(e&&e.stack||e));process.exit(1);});
