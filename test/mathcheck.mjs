const D_PERFECT=12,D_EXPOSED=220,GAMMA_M=1.3,GAMMA_S=1.6,MAX_CONCEAL_OPEN=0.95,CONCEAL_HARDCAP=0.99,MOVE_BEACON=0.85,MOVE_STILL_MAX=20,MOVE_FULL=150;
const clamp01=v=>v<0?0:v>1?1:v;
const HEX={grass:'#4E8C4A',moss:'#5FA663',foliage:'#2F5E37',sand:'#E0CB94',dirt:'#C9A96B',ice:'#ABCFE6',snow:'#E9EEF3',concrete:'#AAB0BC',rock:'#7B7F88',white:'#FFFFFF'};
const rgb=h=>({r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)});
function redmean(a,b){const rb=(a.r+b.r)*.5,dr=a.r-b.r,dg=a.g-b.g,db=a.b-b.b;return Math.sqrt((2+rb/256)*dr*dr+4*dg*dg+(2+(255-rb)/256)*db*db);}
function mq(p,r){const d=redmean(rgb(HEX[p]),rgb(HEX[r]));const t=clamp01((d-D_PERFECT)/(D_EXPOSED-D_PERFECT));return 1-t*t*(3-2*t);}
function smoothstep(e0,e1,x){const t=clamp01((x-e0)/(e1-e0));return t*t*(3-2*t);}
function conceal(m,S,cb,cap){let b=Math.min(Math.pow(m,GAMMA_M)*Math.pow(S,GAMMA_S),MAX_CONCEAL_OPEN);let c=b+cb*(1-b);return Math.min(c,CONCEAL_HARDCAP,cap);}
function C(con,mv,sh){return clamp01((1-con)+MOVE_BEACON*mv+(sh?0.06:0));}
console.log('=== matchQuality calibration (spec target) ===');
const cal=[['grass','grass',1.00],['moss','grass',0.75],['foliage','grass',0.56],['sand','dirt',0.62],['ice','snow',0.46],['concrete','rock',0.28],['white','grass',0.00]];
for(const [a,b,exp] of cal){const v=mq(a,b);console.log(`${a}/${b}: ${v.toFixed(2)}  (spec ${exp.toFixed(2)})  ${Math.abs(v-exp)<=0.06?'OK':'DRIFT'}`);}
console.log('\n=== emergent concealment / C (spec table) ===');
const still=1, moving=smoothstep(MOVE_STILL_MAX,MOVE_FULL,150), creep=smoothstep(MOVE_STILL_MAX,MOVE_FULL,55);
// matched color, settled still
let m1=mq('grass','grass'); let con1=conceal(m1,still,0,0.99); console.log(`matched+still: conceal ${con1.toFixed(2)} (spec 0.95), C ${C(con1,0,false).toFixed(2)} (spec 0.05)`);
// matched still hugging boulder (cover 0.75)
let con2=conceal(m1,still,0.75,0.99); console.log(`matched+still+boulder: conceal ${con2.toFixed(2)} (spec 0.99), C ${C(con2,0,false).toFixed(2)} (spec 0.01)`);
// matched creeping (55)
let Screep=1-creep; let con3=conceal(m1,Screep,0,0.99); console.log(`matched+creep55: conceal ${con3.toFixed(2)} (spec ~0.73), C ${C(con3,creep,false).toFixed(2)} (spec ~0.43)`);
// matched walking 150
let Swalk=1-moving; let con4=conceal(m1,Swalk,0,0.99); console.log(`matched+walk150: conceal ${con4.toFixed(2)} (spec ~0.00), C ${C(con4,moving,false).toFixed(2)} (spec 1.00)`);
// foliage-on-grass still (mq 0.56)
let m5=mq('foliage','grass'); let con5=conceal(m5,still,0,0.99); console.log(`foliage-on-grass still: mq ${m5.toFixed(2)}, conceal ${con5.toFixed(2)} (spec 0.47), C ${C(con5,0,false).toFixed(2)} (spec 0.53)`);
