// Standalone oracle for the P8-3 "Split Camo" per-tone match model.
// Reproduces the in-game math (index.html: matchQualityRef / effMatch / concealment) and asserts:
//  (1) UNIFORM ground → single-color match === matchQuality(paint, terrain) → the calibration table is
//      byte-unchanged (this is why test/mathcheck.mjs is left untouched as the single-color oracle);
//  (2) SPLIT OFF → mqEff === single-color match everywhere (no-op by default);
//  (3) a real 2-terrain SEAM → a single flat color caps well below 1, and two tones recover to ~1;
//  (4) two colors are NEVER worse than one.
// Run: node twotone.mjs   (added to package.json "all"). Exits non-zero on any failed assertion.

const D_PERFECT=12,D_EXPOSED=220,GAMMA_M=1.3,GAMMA_S=1.6,MAX_CONCEAL_OPEN=0.95,CONCEAL_HARDCAP=0.99,MOVE_BEACON=0.85;
const SPLIT_MIN_W=0.18;
const clamp01=v=>v<0?0:v>1?1:v;
const HEX={grass:'#4E8C4A',dirt:'#C9A96B',foliage:'#2F5E37',moss:'#5FA663',sand:'#E0CB94'};
const rgb=h=>({r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)});
function redmean(a,b){const rb=(a.r+b.r)*.5,dr=a.r-b.r,dg=a.g-b.g,db=a.b-b.b;return Math.sqrt((2+rb/256)*dr*dr+4*dg*dg+(2+(255-rb)/256)*db*db);}
function matchQuality(p,r){const d=redmean(p,r);const t=clamp01((d-D_PERFECT)/(D_EXPOSED-D_PERFECT));return 1-t*t*(3-2*t);}
function conceal(m,S,cb,cap){let b=Math.min(Math.pow(m,GAMMA_M)*Math.pow(S,GAMMA_S),MAX_CONCEAL_OPEN);let c=b+cb*(1-b);return Math.min(c,CONCEAL_HARDCAP,cap);}
function C(con,mv,sh){return clamp01((1-con)+MOVE_BEACON*mv+(sh?0.06:0));}

// mirror of index.html
function matchQualityRef(paint, ref){ const tones=ref.tones;
  if(tones && tones.length>1){ let s=0,w=0; for(const t of tones){ s+=t.w*matchQuality(paint,t.rgb); w+=t.w; } if(w>0) return s/w; }
  return matchQuality(paint, ref.rgb); }
function effMatch(pA,pB,split,ref){ const cap=1;                        // grass/dirt/foliage/moss all uncapped
  const single=Math.min(matchQualityRef(pA,ref),cap);
  if(split && pB && ref.tones && ref.tones.length>1 && ref.tones[1].w>SPLIT_MIN_W){
    let s=0,w=0; for(const t of ref.tones){ s+=t.w*Math.max(matchQuality(pA,t.rgb),matchQuality(pB,t.rgb)); w+=t.w; }
    const two=Math.min(w>0?s/w:0,cap); return { mq:Math.max(single,two), mq2:two }; }
  return { mq:single, mq2:0 }; }

function refUniform(k){ const c=rgb(HEX[k]); return { rgb:c, dominantKey:k, tones:[{key:k,rgb:c,w:1}] }; }
function refSeam(k1,w1,k2,w2){ const c1=rgb(HEX[k1]),c2=rgb(HEX[k2]),W=w1+w2;
  return { rgb:{r:(c1.r*w1+c2.r*w2)/W,g:(c1.g*w1+c2.g*w2)/W,b:(c1.b*w1+c2.b*w2)/W},
    dominantKey:w1>=w2?k1:k2, tones:[{key:k1,rgb:c1,w:w1/W},{key:k2,rgb:c2,w:w2/W}] }; }

let fails=0;
const ok=(name,cond,extra='')=>{ console.log(`${cond?'OK  ':'FAIL'}  ${name}${extra?'  '+extra:''}`); if(!cond) fails++; };
const approx=(a,b,e=1e-9)=>Math.abs(a-b)<=e;

console.log('=== (1) UNIFORM ground: per-tone model === matchQuality(paint, terrain) (calibration unchanged) ===');
for(const [p,k] of [['grass','grass'],['moss','grass'],['foliage','grass'],['sand','dirt']]){
  const ref=refUniform(k), got=matchQualityRef(rgb(HEX[p]),ref), want=matchQuality(rgb(HEX[p]),rgb(HEX[k]));
  ok(`${p} on uniform ${k}`, approx(got,want), `ref=${got.toFixed(4)} matchQuality=${want.toFixed(4)}`);
}
// spot-check the calibration concealment values still emerge on uniform ground
{ const mq=matchQualityRef(rgb(HEX.grass),refUniform('grass')); const con=conceal(mq,1,0,0.99);
  ok('matched+still uniform grass conceal 0.95', approx(+con.toFixed(2),0.95), `conceal=${con.toFixed(3)}`);
  const mqf=matchQualityRef(rgb(HEX.foliage),refUniform('grass')); const conf=conceal(mqf,1,0,0.99);
  ok('foliage-on-grass conceal 0.47', approx(+conf.toFixed(2),0.47), `mq=${mqf.toFixed(2)} conceal=${conf.toFixed(3)}`); }

console.log('\n=== (2) SPLIT OFF → mqEff === single (no-op by default) ===');
{ const ref=refSeam('grass',1,'dirt',1);
  const single=effMatch(rgb(HEX.grass),rgb(HEX.dirt),false,ref);
  ok('split off: mq === single, mq2 === 0', single.mq2===0 && approx(single.mq,matchQualityRef(rgb(HEX.grass),ref)),
     `mq=${single.mq.toFixed(3)}`);
  const refU=refUniform('grass'); const su=effMatch(rgb(HEX.grass),rgb(HEX.dirt),true,refU);
  ok('split ON but uniform ground → collapses to single (no benefit)', su.mq2===0 && approx(su.mq,matchQuality(rgb(HEX.grass),rgb(HEX.grass))),
     `mq=${su.mq.toFixed(3)}`); }

console.log('\n=== (3) SEAM grass/dirt 50/50: single caps low, two-tone recovers ===');
{ const ref=refSeam('grass',1,'dirt',1);
  // best single flat color we can reasonably pick: the mean, or either pure tone
  const sMean=matchQualityRef(ref.rgb,ref), sGrass=matchQualityRef(rgb(HEX.grass),ref), sDirt=matchQualityRef(rgb(HEX.dirt),ref);
  const bestSingle=Math.max(sMean,sGrass,sDirt);
  const two=effMatch(rgb(HEX.grass),rgb(HEX.dirt),true,ref);
  ok('single flat color capped below 0.7 on the seam', bestSingle<0.7, `bestSingle=${bestSingle.toFixed(3)} (mean=${sMean.toFixed(3)})`);
  ok('two-tone grass+dirt reaches ~1.0', two.mq>0.98, `two.mq=${two.mq.toFixed(3)}`);
  ok('two-tone strictly beats best single by a clear margin', two.mq-bestSingle>0.3, `+${(two.mq-bestSingle).toFixed(3)}`);
  // concealment payoff: two-tone lets you actually vanish on the seam; single cannot
  const conTwo=conceal(two.mq,1,0,0.99), conSingle=conceal(bestSingle,1,0,0.99);
  ok('two-tone conceal ~0.95 vs single stuck lower', conTwo>0.9 && conSingle<0.7, `two=${conTwo.toFixed(2)} single=${conSingle.toFixed(2)}`); }

console.log('\n=== (4) two colors are never worse than one (any ground) ===');
for(const ref of [refUniform('grass'), refSeam('grass',1,'dirt',1), refSeam('moss',3,'grass',1), refSeam('foliage',1,'sand',1)]){
  for(const [a,b] of [['grass','dirt'],['moss','sand'],['foliage','grass']]){
    const single=effMatch(rgb(HEX[a]),rgb(HEX[b]),false,ref).mq;
    const two=effMatch(rgb(HEX[a]),rgb(HEX[b]),true,ref).mq;
    if(two<single-1e-9){ ok(`monotonic ${a}/${b} on ${ref.dominantKey}`, false, `two=${two.toFixed(3)} < single=${single.toFixed(3)}`); }
  }
}
ok('two-tone monotonicity holds across all fixtures', true);

console.log(fails? `\n${fails} FAILURE(S)` : '\nALL TWO-TONE ASSERTIONS PASS');
process.exit(fails?1:0);
