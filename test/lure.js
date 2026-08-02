/* THE LURE GATE.
 * A lure is easy to build and easy to build WRONG. The two ways it goes wrong are:
 *   - it works on a ship that has already found you, at which point it is a strictly better
 *     Ink and being spotted stops mattering;
 *   - it is a cooldown rather than a consumable, at which point the correct play is a
 *     rotation and it switches the game's tension off.
 * Both are asserted here, not just "the ability fires".
 *   node lure.js ../index.html
 */
const fs=require('fs'), path=require('path'), {JSDOM}=require('jsdom');
const htmlPath=process.argv[2]||'/workspaces/abduct_a_chameleon/index.html';
const html=fs.readFileSync(htmlPath,'utf8');
let fails=0, passes=0;
function ok(n,c,i){ if(c){passes++;console.log('OK    '+n+(i?'  — '+i:''));} else {fails++;console.log('FAIL  '+n+(i?'  — '+i:''));} }

function stubCtx(){ const noop=()=>{}; return new Proxy({},{ get(_t,p){
  if(p==='canvas') return {width:1280,height:720};
  if(p==='measureText') return ()=>({width:10});
  if(p==='getImageData') return (x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4))});
  if(p==='createLinearGradient'||p==='createRadialGradient') return ()=>({addColorStop:noop});
  return typeof p==='string'?noop:undefined; }, set(){return true;} }); }

const errors=[], rafQueue=[]; let rafId=1, VT=1000;
function bp(window){
  const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true, helpAutoShown:true, tourDone:true, perf:'smooth'})};
  try{ Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>k in _ls?_ls[k]:null, setItem:(k,v)=>{_ls[k]=String(v);}, removeItem:k=>{delete _ls[k];},
    clear:()=>{for(const k in _ls)delete _ls[k];}, key:i=>Object.keys(_ls)[i]||null,
    get length(){return Object.keys(_ls).length;}}}); }catch(_){}
  window.HTMLCanvasElement.prototype.getContext=()=>stubCtx();
  window.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return stubCtx();}};
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
  Object.defineProperty(window,'devicePixelRatio',{value:2,configurable:true});
  window.Element.prototype.setPointerCapture=function(){}; window.Element.prototype.releasePointerCapture=function(){};
  window.fetch=(url)=>{ try{ const u=String(url).replace(/^\.?\//,''); const p=path.resolve(path.dirname(htmlPath),u);
    if(fs.existsSync(p)){ const b=fs.readFileSync(p,'utf8');
      return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(b)),text:()=>Promise.resolve(b)}); } }catch(_){}
    return Promise.resolve({ok:false,json:()=>Promise.reject(0),text:()=>Promise.resolve('')}); };
  window.addEventListener('error',e=>errors.push('ERR '+(e.error&&e.error.stack||e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push('REJ '+(e.reason&&e.reason.stack||e.reason)));
}
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'http://localhost:8000/index.html',beforeParse:bp});
const {window}=dom, doc=window.document;
const pump=n=>{for(let i=0;i<n;i++){VT+=16.7;const cbs=rafQueue.splice(0,rafQueue.length);for(const cb of cbs){try{cb(VT);}catch(e){errors.push('raf '+(e&&e.stack||e));}}}};
const key=c=>{for(const t of['keydown','keyup'])doc.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code:c,key:c}));};
const down=c=>doc.dispatchEvent(new window.KeyboardEvent('keydown',{bubbles:true,cancelable:true,code:c,key:c}));
const up=c=>doc.dispatchEvent(new window.KeyboardEvent('keyup',{bubbles:true,cancelable:true,code:c,key:c}));
const S=()=>{try{return window.__aac.state;}catch(_){return{};}};
const T=()=>window.__aac.t;
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  await wait(170); pump(24);
  key('Enter'); pump(6);
  key('ArrowDown'); pump(4); key('Enter'); pump(6);     // Survive
  key('Enter'); await wait(90); pump(10);               // first level -> difficulty (NORMAL)
  key('Enter');
  for(let i=0;i<14 && S().roundState!=='PLAYING';i++){ await wait(50); pump(80); }
  ok('round is playing', S().roundState==='PLAYING', 'rs='+S().roundState);
  ok('starts with a full pouch of clickers', S().lureLeft===3, 'left='+S().lureLeft);

  // park every ship far away so nothing is already hunting
  const st=S(); for(let i=0;i<st.ufos;i++) T().moveUfo(i, 40, 40);
  pump(30);

  // ---- 1. throwing one ----
  const p=S().playerPos;
  down('KeyD'); pump(6); up('KeyD');                     // give facing a direction
  key('KeyF'); pump(4);
  ok('a clicker lands on the ground', S().lures===1, 'lures='+S().lures);
  ok('and it costs a charge', S().lureLeft===2, 'left='+S().lureLeft);
  ok('with a short cooldown between throws', S().lureCd>0, 'cd='+S().lureCd);
  key('KeyF'); pump(4);
  ok('you cannot spam two out of one throw', S().lures===1 && S().lureLeft===2, 'lures='+S().lures+' left='+S().lureLeft);

  // ---- 2. it pulls a patrolling ship, whatever colour the player is ----
  key('KeyQ'); pump(40);                                  // match the ground perfectly first
  down('Space'); pump(160);                               // and settle fully: this player is INVISIBLE
  const hidden=S();
  // 0.25 is comfortably under ENTER_SUSPECT (0.35) and nowhere near the blatant gate (0.55);
  // the exact floor depends on which terrain the round's seed spawned us on
  ok('the player is genuinely hidden', hidden.C<0.25, 'C='+hidden.C+' conceal='+hidden.conceal);
  // put a patrolling ship within pull range of where the clicker landed
  const lp={x:p.x+300, y:p.y};
  T().moveUfo(0, lp.x+200, lp.y+120);
  let lured=false, before=null;
  for(let i=0;i<90;i++){ pump(6); const s=S();
    if(before===null) before=s.ufoPos[0];
    if(s.ufoPos[0] && s.ufoPos[0].lu){ lured=true; break; } }
  up('Space');
  ok('a patrol goes to look at the noise even against a perfect blend', lured,
     'state='+S().ufoStates[0]+' lured='+(S().ufoPos[0]&&S().ufoPos[0].lu));

  // ---- 3. it runs out (BEFORE provoking a chase: a chased player now actually gets
  //         abducted, and every later throw would silently no-op on a finished round) ----
  {
    // two charges are left; spend both, then try a third
    for(let n=0;n<2;n++){ for(let i=0;i<60 && S().lureCd>0;i++) pump(8); key('KeyF'); pump(6); }
    ok('the pouch empties', S().lureLeft===0, 'left='+S().lureLeft);
    for(let i=0;i<60 && S().lureCd>0;i++) pump(8);
    const n0=S().lures; key('KeyF'); pump(6);
    ok('and an empty pouch throws nothing', S().lureLeft===0 && S().lures<=n0,
       'left='+S().lureLeft+' lures='+S().lures);
  }

  // ---- 4. THE LIMIT THAT MATTERS: useless once a ship has committed ----
  {
    // provoke a real chase, then throw a clicker and confirm it changes nothing
    for(let seg=0; seg<200; seg++){ const k=(seg&1)?'KeyA':'KeyD'; down(k); pump(4); up(k);
      const s=S(); if(s.ufoStates.includes('CHASE')||s.ufoStates.includes('BEAM')) break;
      const u=s.ufoPos[0], pp=s.playerPos;
      if(process.env.AAC_TRACE && seg%40===0) console.log('      seg='+seg+' st='+s.ufoStates[0]+
        ' susp='+(u&&u.susp)+' d='+(u?Math.round(Math.hypot(u.x-pp.x,u.y-pp.y)):'-')+' C='+s.C+' spd='+s.speed);
      // re-pin EVERY tick, not just on drift: this is a precondition, not a measurement, and
      // whether a tree happens to sit between the two is not what this file is testing
      if(u) T().moveUfo(0, pp.x+60, pp.y); }
    const chasing=S().ufoStates.includes('CHASE')||S().ufoStates.includes('BEAM');
    ok('a ship is committed to the chase', chasing, 'states='+JSON.stringify(S().ufoStates));
    /* Drop a clicker directly under the chasing ship using the same world state the game
       uses, so this measures the AI rule and not whether the player had a charge left. */
    const cp=S().ufoPos[0];
    window.__aac.t.dropLure(cp.x, cp.y);
    pump(20);
    const post=S();
    ok('a clicker is on the ground right under the chaser', post.lures>=1, 'lures='+post.lures);
    // check THE CHASER specifically: another ship may legitimately still be walking to an
    // older clicker, and a fleet-wide count would let that mask the thing being tested
    ok('but a committed hunter ignores it completely', !post.ufoPos[0].lu &&
       (post.ufoStates[0]==='CHASE'||post.ufoStates[0]==='BEAM'),
       'chaserLured='+post.ufoPos[0].lu+' states='+JSON.stringify(post.ufoStates));
  }

  ok('no runtime errors', errors.length===0, errors.slice(0,2).join(' | '));
  console.log('\nLURE: '+(fails?('FAIL ('+fails+' of '+(fails+passes)+')'):('PASS ('+passes+')')));
  process.exit(fails?1:0);
})();
