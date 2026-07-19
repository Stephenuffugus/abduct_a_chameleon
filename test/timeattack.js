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
(async()=>{ await wait(160);pump(20);
 key('Enter');pump(6);                                  // MODE_SELECT
 for(let i=0;i<5;i++){key('ArrowDown');pump(2);} key('Enter');pump(6);   // Time Attack -> LEVEL
 key('Enter');await wait(70);pump(8);                   // DIFFICULTY
 key('Enter');await wait(30);pump(30);                  // start TA (EASY)
 let st=window.__aac.state; console.log('mode='+st.appState+'/'+st.roundState, 'ta='+JSON.stringify(st.ta&&{beacons:st.ta.beacons,banked:st.ta.banked}));
 pump(210); st=window.__aac.state; console.log('PLAYING beacons='+(st.ta&&st.ta.beacons)+' timeLeft='+(st.ta&&st.ta.timeLeft));
 // fly to nearest beacon
 let banked=false;
 for(let seg=0; seg<260 && !banked; seg++){ st=window.__aac.state; if(!st.ta) break;
   const pp=st.playerPos, bs=st.ta.beaconPos.filter(b=>!b.banked); if(!bs.length){banked=true;break;}
   let best=bs[0],bd=1e18; for(const b of bs){const d=(b.x-pp.x)**2+(b.y-pp.y)**2; if(d<bd){bd=d;best=b;}}
   const dx=best.x-pp.x,dy=best.y-pp.y,dist=Math.hypot(dx,dy);
   if(dist>28){ const hk=Math.abs(dx)>10?(dx>0?'KeyD':'KeyA'):null, vk=Math.abs(dy)>10?(dy>0?'KeyS':'KeyW'):null; if(hk)down(hk);if(vk)down(vk); pump(6); if(hk)up(hk);if(vk)up(vk); }
   else { key('KeyQ'); pump(2); pump(30); }   // on beacon: match + hold still to bank
   st=window.__aac.state; if(st.ta && st.ta.banked>0){ banked=true; console.log('BANKED '+st.ta.banked+'/'+st.ta.beacons+' at seg '+seg); break; }
   if(st.appState==='SUMMARY'){ console.log('SUMMARY '+(st.ta?'':'(ended)')); break; }
 }
 st=window.__aac.state; console.log('final appState='+st.appState+' banked='+(st.ta?st.ta.banked:'(ended)')+' sawBanked='+banked);
 console.log('errors='+errors.length+(errors.length?' '+errors.slice(0,3).join('|'):'')); process.exit(errors.length?1:0);
})().catch(e=>{console.log('CAUGHT '+(e&&e.stack||e));process.exit(1);});