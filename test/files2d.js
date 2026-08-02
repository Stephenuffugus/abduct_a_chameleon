/* THE ARCHIVE HAS TO OPEN.
 *
 *   node files2d.js [../index.html]
 *
 * THE ABDUCTION FILES is 880 pages of written content reached from the title screen,
 * and it shipped completely dead to input. Its rows were registered in `roundHits`,
 * which onPointerDown only consults while appState === 'ROUND'; this screen is
 * appState === 'FILES', so not one row was tappable by touch, mouse, keyboard or
 * gamepad. `filesScroll` was clamped every frame and written by nothing at all, so the
 * list was pinned at offset 0 and showed seven entries out of eight hundred and eighty
 * - all reading "not yet recovered", because pages are numbered in order and recovered
 * at random. A player opening it saw an empty archive and no way to move.
 *
 * The rules:
 *   1. The screen is reachable from the title.
 *   2. A recovered page can be OPENED by tapping its row.
 *   3. The list SCROLLS, and scrolling changes which rows are hit-testable.
 *   4. A drag does not count as a tap (or every scroll opens a page).
 *   5. The Back button gets you out.
 */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const htmlPath = process.argv[2] || path.resolve(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const errors = [], rafQueue = []; let rafId = 1;
let VW = 390, VH = 740;

function stubCtx() {
  const noop = () => {};
  return new Proxy({}, { get(_t, p) {
    if (p === 'canvas') return { width: VW, height: VH };
    if (p === 'measureText') return (s) => ({ width: String(s).length * 6 });
    if (p === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w|0)*(h|0)*4)), width: w|0, height: h|0 });
    if (p === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w|0)*(h|0)*4)), width: w|0, height: h|0 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop: noop });
    if (p === 'setTransform' || p === 'getTransform') return () => ({ a:1, b:0, c:0, d:1, e:0, f:0 });
    return typeof p === 'string' ? noop : undefined;
  }, set() { return true; } });
}
/* Pretend a handful of pages have been recovered. An archive where you own nothing is
 * exactly the state the bug hid behind: every row greyed, so "nothing opens" looked
 * like the intended empty state rather than a dead screen. */
const OWNED = [1, 2, 3, 12, 40, 41, 77, 120, 340, 700];
function beforeParse(window) {
  const _ls = {
    'aac.settings.v1': JSON.stringify({ tutorialSeen:true, helpAutoShown:true, tourDone:true, perf:'smooth' }),
    'aac.files.v1': JSON.stringify(OWNED),
  };
  Object.defineProperty(window, 'localStorage', { configurable:true, value:{
    getItem:k=>k in _ls?_ls[k]:null, setItem:(k,v)=>{_ls[k]=String(v);}, removeItem:k=>{delete _ls[k];},
    clear:()=>{}, key:i=>Object.keys(_ls)[i]||null, get length(){return Object.keys(_ls).length;} } });
  window.HTMLCanvasElement.prototype.getContext = () => stubCtx();
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  window.OffscreenCanvas = class { constructor(w,h){this.width=w;this.height=h;} getContext(){return stubCtx();} };
  window.requestAnimationFrame = cb => { rafQueue.push(cb); return rafId++; };
  window.cancelAnimationFrame = () => {};
  const A = class { constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}
    createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createOscillator(){return{type:'',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},start(){},stop(){}};}
    createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}};}
    createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}
    createBufferSource(){return{connect(){},start(){},stop(){}};}
    createDynamicsCompressor(){return{connect(){},threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}};}
    resume(){return Promise.resolve();} };
  window.AudioContext = A; window.webkitAudioContext = A;
  window.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  window.navigator.getGamepads = () => [];
  Object.defineProperty(window, 'devicePixelRatio', { value:1, configurable:true });
  Object.defineProperty(window, 'innerWidth', { get:()=>VW, configurable:true });
  Object.defineProperty(window, 'innerHeight', { get:()=>VH, configurable:true });
  window.Element.prototype.setPointerCapture = function(){};
  window.Element.prototype.releasePointerCapture = function(){};
  window.fetch = (url) => { try { const u=String(url).replace(/^\.?\//,''); const p=path.resolve(path.dirname(htmlPath),u);
      if (fs.existsSync(p)) { const b=fs.readFileSync(p,'utf8'); return Promise.resolve({ ok:true, json:()=>Promise.resolve(JSON.parse(b)), text:()=>Promise.resolve(b) }); } } catch(_) {}
    return Promise.resolve({ ok:false, json:()=>Promise.reject(0), text:()=>Promise.resolve('') }); };
  window.addEventListener('error', e => errors.push(String(e.message)));
}
const dom = new JSDOM(html, { runScripts:'dangerously', resources:'usable', pretendToBeVisual:true,
  url:'http://localhost:8000/index.html', beforeParse });
const { window } = dom, doc = window.document;
const pump = n => { for (let i=0;i<n;i++){ const cbs=rafQueue.splice(0,rafQueue.length); for(const cb of cbs){ try{cb(performance.now());}catch(e){errors.push(String(e&&e.message||e));} } } };
const S = () => window.__aac.state;
const R = () => window.__aac;
const wait = ms => new Promise(r=>setTimeout(r,ms));
const cv = () => doc.querySelector('canvas');
function pev(type, x, y, id) {
  const e = new window.Event(type, { bubbles:true, cancelable:true });
  Object.assign(e, { clientX:x, clientY:y, pointerId:id, pointerType:'touch' });
  cv().dispatchEvent(e);
}
function tap(x, y, id) { pev('pointerdown', x, y, id); pump(2); pev('pointerup', x, y, id); pump(4); }
function drag(x, y0, y1, id) { pev('pointerdown', x, y0, id); pump(2);
  for (let k=1;k<=6;k++) { pev('pointermove', x, y0 + (y1-y0)*k/6, id); pump(1); }
  pev('pointerup', x, y1, id); pump(4); }

let fails = 0;
function ok(name, cond, detail) { if (cond) console.log('OK    ' + name + (detail?'  — '+detail:''));
  else { fails++; console.log('FAIL  ' + name + (detail?'  — '+detail:'')); } }

(async () => {
  for (let i=0;i<200;i++){ pump(4); let r=false; try{ r = S().appState==='TITLE'; }catch(_){}
    if (r) break; await wait(25); }
  /* ⛔ THE PAGE BANKS ARE <script src> FILES AND JSDOM CANNOT FETCH THEM. The document
     url is http://localhost:8000 and nothing is serving it, so window.AAC_FILES stays
     undefined and the archive is legitimately empty - which would make this gate green
     against a dead screen for the wrong reason. Run the banks by hand. */
  if (!window.AAC_FILES) {
    const dir = path.join(path.dirname(htmlPath), 'pages');
    for (const f of fs.readdirSync(dir).filter(n => /^files-\d+\.js$/.test(n))
                      .sort((a,b)=>parseInt(a.match(/\d+/)[0])-parseInt(b.match(/\d+/)[0]))) {
      try { window.eval(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { errors.push('bank ' + f + ': ' + e.message); }
    }
  }
  ok('the page bank actually loaded', !!(window.AAC_FILES && window.AAC_FILES.length),
     (window.AAC_FILES ? window.AAC_FILES.length : 0) + ' pages');
  pump(20);

  const rects0 = R().navRects();
  const filesBtn = rects0.find(n => /the files/i.test(n.label||''));
  ok('the archive is reachable from the title', !!filesBtn, filesBtn ? `"${filesBtn.label}"` : 'no such button');
  if (!filesBtn) { console.log('\nFILES2D: FAIL'); process.exit(1); }
  tap(filesBtn.x + filesBtn.w/2, filesBtn.y + filesBtn.h/2, 11); pump(8);
  ok('tapping it opens THE ABDUCTION FILES', S().appState==='FILES', 'app='+S().appState);

  const rows = () => R().navRects().filter(n => /^page /.test(n.label||''));
  const r1 = rows();
  ok('recovered pages are registered as tappable rows', r1.length > 0, r1.length + ' rows hit-testable');
  if (!r1.length) { console.log('\nFILES2D: FAIL — the list is dead to input'); process.exit(1); }

  // 2. a row opens its page
  tap(r1[0].x + r1[0].w/2, r1[0].y + r1[0].h/2, 12); pump(8);
  const opened = window.__aac.state && R().navRects();
  ok('tapping a recovered row opens the page', !!S().filesOpen, 'filesOpen=' + S().filesOpen);
  // back out of the page
  for (const t of ['keydown','keyup']) doc.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code:'Escape',key:'Escape'}));
  pump(8);
  ok('Escape closes the page and keeps you in the archive', !S().filesOpen && S().appState==='FILES',
     'filesOpen=' + S().filesOpen + ' app=' + S().appState);

  // 3. the list scrolls, and scrolling changes which rows are reachable
  const before = S().filesScroll;
  drag(VW/2, VH*0.55, VH*0.20, 13); pump(6);
  const after = S().filesScroll;
  ok('dragging scrolls the list', after > before + 20, before + ' -> ' + after);
  const r2 = rows();
  ok('scrolling brings different rows within reach',
     r2.length === 0 || r1.length === 0 || JSON.stringify(r1.map(r=>r.label)) !== JSON.stringify(r2.map(r=>r.label)),
     'was [' + r1.map(r=>r.label).join(',') + '] now [' + r2.map(r=>r.label).join(',') + ']');

  // 4. a drag is not a tap
  const openedByDrag = S().filesOpen;
  ok('a scroll drag does not open a page', !openedByDrag, 'filesOpen=' + openedByDrag);

  // 5. and you can get out
  const back = R().navRects().find(n => /back/i.test(n.label||''));
  ok('there is a Back button', !!back, back ? `${Math.round(back.w)}x${Math.round(back.h)}` : 'missing');
  if (back) { tap(back.x + back.w/2, back.y + back.h/2, 14); pump(8);
    ok('Back returns to the title', S().appState==='TITLE', 'app='+S().appState); }

  if (errors.length) { fails++; console.log('FAIL  runtime errors  — ' + [...new Set(errors)].slice(0,2).join(' | ')); }
  console.log(fails ? `\nFILES2D: FAIL (${fails})` : '\nFILES2D: PASS — the archive opens, a page opens, the list scrolls, and a drag is not a tap');
  process.exit(fails ? 1 : 0);
})();
