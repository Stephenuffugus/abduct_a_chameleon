/* HUNT fairness gate — Stephen 2026-07-29: "almost impossible to catch the
 * bots, they move so fast and turn on a dime and you have to stay in such a
 * tight circle its really really hard even on easy."
 *
 * The existing hunt.js chaser re-aims EVERY OTHER FRAME, which no thumb does.
 * This test plays like a person: it reacts to where a bot WAS 200ms ago,
 * re-aims only every ~180ms, and pings on cooldown. On EASY, that hunter must
 * clear all bots with time to spare. If this fails, EASY is not easy.
 */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const htmlPath='/workspaces/abduct_a_chameleon/index.html';const html=fs.readFileSync(htmlPath,'utf8');
const errors=[];const rafQueue=[];let VT=1000;
function bp(window){ try{const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true,helpAutoShown:true})}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{},key:()=>null,length:1}});}catch(_){}
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
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const L=m=>console.log(m);
let fails=0; function check(name,cond,detail){ L((cond?'PASS':'FAIL')+'  '+name+(detail!==undefined?'  ['+detail+']':'')); if(!cond)fails++; }

/* One human-model round. The difficulty menu OPENS at index 1 (NORMAL) —
   verified at index.html menuIndex=1 — so EASY is one ArrowUp. */
async function playRound(diffKeys){
  key('Enter');pump(6);
  for(let i=0;i<4;i++){key('ArrowDown');pump(2);} key('Enter');pump(6);   // HUNT
  key('Enter');await wait(70);pump(8);                                    // level select
  for(const k of diffKeys){key(k);pump(2);}
  key('Enter');await wait(30);pump(40);                                   // countdown + go
  const S=()=>window.__aac.state;
  const posLog=[];        // 200ms of bot-position memory (12 frames)
  let heldH=null,heldV=null,frame=0;
  const HFRAMES=7200;     // 120s
  while(frame<HFRAMES){
    const st=S();
    if(st.appState==='SUMMARY') break;
    if(!st.hunt){ break; }
    posLog.push({pp:st.playerPos,bots:st.hunt.botPos.map(b=>({x:b.x,y:b.y,caught:b.caught}))});
    if(posLog.length>12)posLog.shift();
    if(frame%11===0){                                     // re-aim ~every 180ms
      const seen=posLog[0];                               // ...at 200ms-old info
      const live=seen.bots.filter(b=>!b.caught);
      if(live.length){
        const pp=st.playerPos;
        let best=live[0],bd=1e18;
        for(const b of live){const d=(b.x-pp.x)**2+(b.y-pp.y)**2;if(d<bd){bd=d;best=b;}}
        const dx=best.x-pp.x,dy=best.y-pp.y;
        const wantH=Math.abs(dx)>8?(dx>0?'KeyD':'KeyA'):null;
        const wantV=Math.abs(dy)>8?(dy>0?'KeyS':'KeyW'):null;
        if(heldH!==wantH){ if(heldH)up(heldH); if(wantH)down(wantH); heldH=wantH; }
        if(heldV!==wantV){ if(heldV)up(heldV); if(wantV)down(wantV); heldV=wantV; }
      }
    }
    if(frame%200===0) key('Space');                       // ping on cooldown-ish
    pump(1); frame++;
  }
  if(heldH)up(heldH); if(heldV)up(heldV);
  const st=window.__aac.state;
  const sum=st.summary||{};
  const out={ caught: sum.caught!==undefined?sum.caught:(st.hunt?st.hunt.caught:0),
              total: sum.total!==undefined?sum.total:(st.hunt?st.hunt.bots:0),
              outcome: sum.outcome||'(running)', frames: frame };
  // back to the title for the next round
  key('Enter');await wait(30);pump(10); key('Escape');pump(6); key('Escape');pump(6);
  return out;
}

/* One difficulty per PROCESS: menu state after a summary is path-dependent
   (the first version's second round silently re-selected EASY and measured
   nothing). Cold boot -> the difficulty menu opens at NORMAL, always. */
const WHICH=(process.argv[2]||'EASY').toUpperCase();
const KEYS={EASY:['ArrowUp'],NORMAL:[],HARD:['ArrowDown']}[WHICH]||['ArrowUp'];
const BOTS={EASY:3,NORMAL:4,HARD:5}[WHICH];
(async()=>{ await wait(160);pump(20);
  const r=await playRound(KEYS);
  L(WHICH+'  human-model: caught '+r.caught+'/'+r.total+' outcome='+r.outcome+' in '+(r.frames/60|0)+'s');
  check(WHICH+' selected ('+BOTS+' chameleons)', r.total===BOTS, r.total);
  if(WHICH==='EASY'){
    check('EASY: the human-model hunter clears the round', r.caught===r.total && r.total>0, r.caught+'/'+r.total);
    check('EASY: with real time to spare (<=105s)', r.frames<=6300, (r.frames/60|0)+'s');
  } else {
    check(WHICH+': the sloppy hunter does not blitz it (>=40s or incomplete)', r.caught<r.total || r.frames>=2400, r.caught+'/'+r.total+' in '+(r.frames/60|0)+'s');
  }
  check('no runtime errors', errors.length===0, errors.slice(0,2).join('|'));
  process.exit(fails?1:0);
})().catch(e=>{L('THREW '+(e&&e.stack||e));process.exit(1);});
