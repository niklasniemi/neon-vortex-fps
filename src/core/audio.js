import {U,_vd,_ve} from './util.js';
import {SETTINGS,saveSettings} from './config.js';
import {GFX} from './globals.js';

export class AudioSynth{
constructor(){this.ctx=null;this._last={};this._charge=null;this._amb=null}
init(){
if(this.ctx)return;
try{
const AC=window.AudioContext||window.webkitAudioContext;
this.ctx=new AC();
const c=this.ctx;
this.master=c.createGain();this.master.gain.value=SETTINGS.vol;
this.comp=c.createDynamicsCompressor();
this.master.connect(this.comp);this.comp.connect(c.destination);
this.sfx=c.createGain();this.sfx.connect(this.master);
this.ui=c.createGain();this.ui.gain.value=.8;this.ui.connect(this.master);
this.amb=c.createGain();this.amb.gain.value=.5;this.amb.connect(this.master);
const len=c.sampleRate*1.2,buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);
for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
this.noiseBuf=buf;
}catch(e){console.warn("audio unavailable",e)}
}
setVolume(v){SETTINGS.vol=v;if(this.master)this.master.gain.value=v;saveSettings()}
resume(){if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume()}
throttle(name,min){const t=performance.now()/1000;if(this._last[name]&&t-this._last[name]<min)return false;this._last[name]=t;return true}
panner(pos){
const p=this.ctx.createPanner();
p.panningModel="equalpower";p.distanceModel="inverse";p.refDistance=6;p.maxDistance=120;p.rolloffFactor=1.1;
if(p.positionX){p.positionX.value=pos.x;p.positionY.value=pos.y;p.positionZ.value=pos.z}else p.setPosition(pos.x,pos.y,pos.z);
return p;
}
play(name,opt={}){
if(!this.ctx)return;
const def=SOUND_DEFS[name];if(!def)return;
if(!opt.force&&!this.throttle(name,opt.minGap||(def.ui?.02:.04)))return;
const c=this.ctx,t0=c.currentTime+(opt.delay||0);
let dest=def.ui?this.ui:this.sfx;
if(opt.pos&&dest===this.sfx){const pn=this.panner(opt.pos);pn.connect(dest);dest=pn}
const vol=(opt.vol!==undefined?opt.vol:1)*(def.v||1);
for(const L of def.layers)this.layer(L,t0+(L.delay||0),vol,opt.rate||1,dest);
}
layer(L,t0,vol,rate,dest){
const c=this.ctx,g=c.createGain();
let head=g;
if(L.ft){const f=c.createBiquadFilter();f.type=L.ft;f.frequency.setValueAtTime(L.ff0,t0);f.frequency.exponentialRampToValueAtTime(Math.max(30,L.ff1),t0+L.dur);f.Q.value=L.q||1;f.connect(g);head=f}
head.connect(dest);
const gv=(L.g0||.5)*vol;
g.gain.setValueAtTime(gv,t0);
g.gain.exponentialRampToValueAtTime(Math.max(.0001,(L.g1||.001)*vol),t0+L.dur);
let src;
if(L.t==="n"){src=c.createBufferSource();src.buffer=this.noiseBuf;src.playbackRate.value=rate*(L.pr||1)}
else{src=c.createOscillator();src.type=L.w||"sine";src.frequency.setValueAtTime(L.f0,t0);src.frequency.exponentialRampToValueAtTime(Math.max(20,L.f1),t0+L.dur)}
src.connect(head);src.start(t0);src.stop(t0+L.dur+.06);
}
tone(freq,dur,wave,vol,when,slide){
if(!this.ctx)return;const c=this.ctx,t0=c.currentTime+(when||0);
const o=c.createOscillator(),g=c.createGain();
o.type=wave||"square";o.frequency.setValueAtTime(freq,t0);
if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,slide),t0+dur);
g.gain.setValueAtTime(vol||.2,t0);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
o.connect(g);g.connect(this.sfx);o.start(t0);o.stop(t0+dur+.05);
}
startCharge(){
if(!this.ctx||this._charge)return;const c=this.ctx;
const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
o.type="sawtooth";o.frequency.setValueAtTime(80,c.currentTime);
o.frequency.exponentialRampToValueAtTime(640,c.currentTime+.75);
f.type="lowpass";f.frequency.value=1400;
g.gain.setValueAtTime(.0001,c.currentTime);
g.gain.exponentialRampToValueAtTime(.14,c.currentTime+.6);
o.connect(f);f.connect(g);g.connect(this.sfx);o.start();
this._charge={o,g};
}
stopCharge(){
if(!this._charge)return;const c=this.ctx,{o,g}=this._charge;this._charge=null;
try{g.gain.cancelScheduledValues(c.currentTime);g.gain.setValueAtTime(g.gain.value,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.08);o.stop(c.currentTime+.1)}catch(e){}
}
heartbeat(){
if(!this.ctx)return;
this.tone(52,.14,"sine",.5,0,38);this.tone(48,.16,"sine",.42,.19,36);
}
fanfare(win){
const seq=win?[392,523,659,784,1046]:[392,330,262,196];
seq.forEach((f,i)=>{this.tone(f,.32,"triangle",.24,i*.13);this.tone(f*2,.28,"sine",.08,i*.13)});
}
ambient(key){
this.stopAmbient();if(!this.ctx)return;
const c=this.ctx,nodes=[],t0=c.currentTime;
const mkOsc=(f,type,v,filtF,lfoR,lfoA)=>{
const o=c.createOscillator(),g=c.createGain(),fl=c.createBiquadFilter();
o.type=type;o.frequency.value=f;fl.type="lowpass";fl.frequency.value=filtF;
g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(v,t0+2.5);
const lfo=c.createOscillator(),lg=c.createGain();
lfo.frequency.value=lfoR;lg.gain.value=lfoA;lfo.connect(lg);lg.connect(g.gain);lfo.start();
o.connect(fl);fl.connect(g);g.connect(this.amb);o.start();nodes.push(o,lfo);};
if(key==="cyber"){mkOsc(55,"sawtooth",.05,320,.07,.02);mkOsc(82.41,"sawtooth",.04,300,.11,.018);mkOsc(110,"triangle",.03,500,.05,.012)}
else if(key==="industrial"){
const n=c.createBufferSource();n.buffer=this.noiseBuf;n.loop=true;
const f=c.createBiquadFilter();f.type="lowpass";f.frequency.value=140;
const g=c.createGain();g.gain.value=.09;n.connect(f);f.connect(g);g.connect(this.amb);n.start();nodes.push(n);}
else{mkOsc(220,"sine",.035,900,.05,.015);mkOsc(331,"sine",.028,900,.08,.012);mkOsc(659,"sine",.012,1600,.13,.008)}
this._amb={nodes};
}
stopAmbient(){
if(!this._amb)return;
for(const n of this._amb.nodes){try{n.stop()}catch(e){}}
this._amb=null;
}
updateListener(cam){
if(!this.ctx)return;const l=this.ctx.listener,p=cam.position;
_vd.set(0,0,-1).applyQuaternion(cam.quaternion);
_vd.set(0,0,-1).applyQuaternion(cam.quaternion);
_ve.set(0,1,0).applyQuaternion(cam.quaternion);
if(l.positionX){
l.positionX.value=p.x;l.positionY.value=p.y;l.positionZ.value=p.z;
l.forwardX.value=_vd.x;l.forwardY.value=_vd.y;l.forwardZ.value=_vd.z;
l.upX.value=_ve.x;l.upY.value=_ve.y;l.upZ.value=_ve.z;
}else{l.setPosition(p.x,p.y,p.z);l.setOrientation(_vd.x,_vd.y,_vd.z,_ve.x,_ve.y,_ve.z)}
}
}
export const SOUND_DEFS={
ui_click:{ui:true,layers:[{t:"o",w:"square",f0:900,f1:600,dur:.06,g0:.12}]},
shot_rifle:{layers:[{t:"n",dur:.09,g0:.55,g1:.001,ft:"bandpass",ff0:2400,ff1:700,q:.8},{t:"o",w:"square",f0:210,f1:70,dur:.08,g0:.3}]},
shot_shotgun:{layers:[{t:"n",dur:.24,g0:.85,g1:.001,ft:"lowpass",ff0:3200,ff1:280,q:.7},{t:"o",w:"sawtooth",f0:130,f1:38,dur:.22,g0:.4}]},
shot_plasma:{layers:[{t:"o",w:"sawtooth",f0:880,f1:110,dur:.3,g0:.4},{t:"o",w:"sine",f0:1760,f1:220,dur:.2,g0:.2}]},
shot_vortex:{layers:[{t:"o",w:"square",f0:340,f1:520,dur:.16,g0:.3},{t:"n",dur:.12,g0:.25,g1:.001,ft:"highpass",ff0:900,ff1:2400,q:1}]},
rail_fire:{v:1.1,layers:[{t:"o",w:"sawtooth",f0:2400,f1:90,dur:.4,g0:.5},{t:"n",dur:.3,g0:.5,g1:.001,ft:"highpass",ff0:1500,ff1:400,q:1},{t:"o",w:"sine",f0:60,f1:40,dur:.35,g0:.5}]},
dry:{ui:true,layers:[{t:"o",w:"square",f0:520,f1:380,dur:.05,g0:.12}]},
reload1:{layers:[{t:"n",dur:.07,g0:.3,g1:.001,ft:"bandpass",ff0:1800,ff1:900,q:2},{t:"o",w:"square",f0:300,f1:190,dur:.06,g0:.12}]},
reload2:{layers:[{t:"n",dur:.08,g0:.35,g1:.001,ft:"bandpass",ff0:1200,ff1:500,q:2},{t:"o",w:"square",f0:420,f1:260,dur:.07,g0:.14}]},
step_metal:{layers:[{t:"n",dur:.07,g0:.14,g1:.001,ft:"bandpass",ff0:800,ff1:250,q:1.4}],minGap:.1},
step_grate:{layers:[{t:"n",dur:.08,g0:.17,g1:.001,ft:"bandpass",ff0:1500,ff1:420,q:1.1}],minGap:.1},
jump:{layers:[{t:"o",w:"sine",f0:280,f1:420,dur:.12,g0:.1}]},
land:{layers:[{t:"n",dur:.1,g0:.3,g1:.001,ft:"lowpass",ff0:600,ff1:150,q:.8}]},
pad:{layers:[{t:"o",w:"sine",f0:180,f1:720,dur:.3,g0:.3},{t:"n",dur:.25,g0:.2,g1:.001,ft:"highpass",ff0:600,ff1:2200,q:1}]},
teleport:{layers:[{t:"o",w:"sine",f0:400,f1:1900,dur:.35,g0:.25},{t:"o",w:"sine",f0:1900,f1:500,dur:.3,g0:.18,delay:.05}]},
pk_health:{layers:[{t:"o",w:"sine",f0:520,f1:1040,dur:.16,g0:.25}]},
pk_ammo:{layers:[{t:"o",w:"square",f0:340,f1:480,dur:.1,g0:.18},{t:"o",w:"square",f0:480,f1:680,dur:.1,g0:.18,delay:.07}]},
pk_power:{layers:[{t:"o",w:"sawtooth",f0:220,f1:880,dur:.5,g0:.3},{t:"o",w:"sine",f0:1760,f1:1760,dur:.4,g0:.1,delay:.1}]},
hit:{layers:[{t:"o",w:"square",f0:1300,f1:900,dur:.045,g0:.22}]},
hit_head:{layers:[{t:"o",w:"sine",f0:1900,f1:1300,dur:.09,g0:.28},{t:"o",w:"sine",f0:2850,f1:2600,dur:.07,g0:.1}]},
kill:{layers:[{t:"o",w:"sine",f0:880,f1:880,dur:.22,g0:.3},{t:"o",w:"sine",f0:1320,f1:1320,dur:.3,g0:.2,delay:.06}]},
hurt:{layers:[{t:"o",w:"sawtooth",f0:220,f1:110,dur:.14,g0:.25},{t:"n",dur:.1,g0:.2,g1:.001,ft:"lowpass",ff0:900,ff1:300,q:1}]},
explosion:{v:1.2,layers:[{t:"n",dur:.7,g0:1,g1:.001,ft:"lowpass",ff0:2400,ff1:90,q:.6},{t:"o",w:"sine",f0:110,f1:30,dur:.55,g0:.7}]},
sticky_stick:{layers:[{t:"n",dur:.05,g0:.3,g1:.001,ft:"highpass",ff0:1000,ff1:2000,q:1},{t:"o",w:"square",f0:700,f1:500,dur:.05,g0:.12}]},
shock:{layers:[{t:"n",dur:.2,g0:.5,g1:.001,ft:"bandpass",ff0:2600,ff1:800,q:1.4},{t:"o",w:"sawtooth",f0:1600,f1:120,dur:.18,g0:.25}]},
beep:{ui:true,layers:[{t:"o",w:"square",f0:880,f1:880,dur:.12,g0:.15},{t:"o",w:"square",f0:1174,f1:1174,dur:.16,g0:.15,delay:.12}]},
spawn:{layers:[{t:"o",w:"sine",f0:300,f1:900,dur:.25,g0:.15}]},
sizzle:{layers:[{t:"n",dur:.3,g0:.3,g1:.001,ft:"highpass",ff0:2400,ff1:3600,q:.7}],minGap:.35},
shield_hit:{layers:[{t:"o",w:"sine",f0:640,f1:320,dur:.12,g0:.2}]},
pin:{layers:[{t:"n",dur:.05,g0:.25,g1:.001,ft:"highpass",ff0:1800,ff1:3000,q:1},{t:"o",w:"square",f0:900,f1:700,dur:.05,g0:.1}]},
nadebounce:{layers:[{t:"n",dur:.04,g0:.3,g1:.001,ft:"bandpass",ff0:1400,ff1:600,q:2}],minGap:.08},
heboom:{v:1.25,layers:[{t:"n",dur:.55,g0:1,g1:.001,ft:"lowpass",ff0:3000,ff1:120,q:.6},{t:"o",w:"sine",f0:140,f1:35,dur:.5,g0:.8}]},
flashpop:{v:1.1,layers:[{t:"n",dur:.18,g0:.9,g1:.001,ft:"highpass",ff0:1000,ff1:4000,q:.7},{t:"o",w:"sine",f0:1150,f1:1100,dur:1.6,g0:.22}]},
smokehiss:{layers:[{t:"n",dur:2.2,g0:.35,g1:.001,ft:"bandpass",ff0:2600,ff1:1400,q:.6}],minGap:.3},
fireignite:{layers:[{t:"n",dur:.5,g0:.6,g1:.001,ft:"lowpass",ff0:1800,ff1:400,q:.8},{t:"n",dur:.9,g0:.3,g1:.001,ft:"bandpass",ff0:900,ff1:500,q:1.2}],minGap:.3},
firecrack:{layers:[{t:"n",dur:.14,g0:.3,g1:.001,ft:"bandpass",ff0:1100,ff1:500,q:1}],minGap:.25},
};
