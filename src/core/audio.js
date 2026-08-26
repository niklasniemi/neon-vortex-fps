// Procedural audio engine.
//
// Everything is synthesised at runtime -- there are no sample files to ship.
// The previous version was a single oscillator plus an exponential ramp per
// layer, with no space and no tail, and roughly half the sounds the game asks
// for had no definition at all (the AWP, Deagle, pistols, SMG, knife,
// footsteps and every UI click were silent, because play() bails when it
// cannot find a def).
//
// The signal chain is now:
//
//   layers -> [dry] ----------------\
//          -> [send] -> convolver ---> bus -> compressor -> master -> out
//
// with a procedurally generated impulse response for the room, HRTF panning
// for positional sources, air-absorption rolloff on distant sounds, and
// per-shot pitch/timbre jitter so repeated gunfire never sounds looped.
import {U,_vd,_ve} from './util.js';
import {SETTINGS,saveSettings} from './config.js';
import {GFX} from './globals.js';

export class AudioSynth{
  constructor(){
    this.ctx=null;this._last={};this._amb=null;this._music=null;this._charge=null;
  }

  init(){
    if(this.ctx)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      this.ctx=new AC({latencyHint:"interactive"});
      const c=this.ctx;

      // --- master chain ----------------------------------------------------
      this.master=c.createGain();
      this.master.gain.value=SETTINGS.vol;

      // Gentle bus glue. The old settings squashed transients flat, which is
      // most of why gunfire sounded like clicks.
      this.comp=c.createDynamicsCompressor();
      this.comp.threshold.value=-14;
      this.comp.knee.value=22;
      this.comp.ratio.value=3.2;
      this.comp.attack.value=.004;
      this.comp.release.value=.18;

      // Tame the very top end so noise bursts read as air, not hiss.
      this.tilt=c.createBiquadFilter();
      this.tilt.type="highshelf";
      this.tilt.frequency.value=7200;
      this.tilt.gain.value=-4;

      this.master.connect(this.comp);
      this.comp.connect(this.tilt);
      this.tilt.connect(c.destination);

      // --- buses -----------------------------------------------------------
      this.sfx=c.createGain();  this.sfx.gain.value=.9;  this.sfx.connect(this.master);
      this.ui=c.createGain();   this.ui.gain.value=.55;  this.ui.connect(this.master);
      this.amb=c.createGain();  this.amb.gain.value=.42; this.amb.connect(this.master);
      this.mus=c.createGain();  this.mus.gain.value=.30; this.mus.connect(this.master);

      // --- reverb ----------------------------------------------------------
      this.conv=c.createConvolver();
      this.conv.buffer=this.makeImpulse(2.1,2.6);
      this.revGain=c.createGain();
      this.revGain.gain.value=.9;
      this.conv.connect(this.revGain);
      this.revGain.connect(this.master);

      // --- noise sources ---------------------------------------------------
      this.noise={
        white:this.makeNoise("white"),
        pink:this.makeNoise("pink"),
        brown:this.makeNoise("brown")
      };
      this.noiseBuf=this.noise.white;      // legacy alias
    }catch(e){
      console.warn("audio unavailable",e);
    }
  }

  /**
   * Procedural room impulse: exponentially decaying noise with a short
   * pre-delay and a darkening tail, which is what gives shots a sense of being
   * fired inside stone corridors rather than in a vacuum.
   */
  makeImpulse(seconds,decay){
    const c=this.ctx, rate=c.sampleRate;
    const len=Math.max(1,Math.floor(rate*seconds));
    const buf=c.createBuffer(2,len,rate);
    for(let ch=0;ch<2;ch++){
      const d=buf.getChannelData(ch);
      let lp=0;
      const pre=Math.floor(rate*.012);
      for(let i=0;i<len;i++){
        if(i<pre){d[i]=0;continue}
        const t=(i-pre)/(len-pre);
        const env=Math.pow(1-t,decay);
        // one-pole lowpass darkens the tail as it decays
        const n=Math.random()*2-1;
        lp+=(n-lp)*(.22-.16*t);
        d[i]=lp*env*(ch?.92:1);
      }
    }
    return buf;
  }

  /** Coloured noise. Pink and brown read far more naturally than white. */
  makeNoise(kind){
    const c=this.ctx, rate=c.sampleRate;
    const len=Math.floor(rate*2);
    const buf=c.createBuffer(1,len,rate);
    const d=buf.getChannelData(0);
    if(kind==="white"){
      for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    }else if(kind==="brown"){
      let last=0;
      for(let i=0;i<len;i++){
        const w=Math.random()*2-1;
        last=(last+w*.02)/1.02;
        d[i]=last*3.5;
      }
    }else{
      // Voss-McCartney pink
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for(let i=0;i<len;i++){
        const w=Math.random()*2-1;
        b0=.99886*b0+w*.0555179; b1=.99332*b1+w*.0750759;
        b2=.96900*b2+w*.1538520; b3=.86650*b3+w*.3104856;
        b4=.55000*b4+w*.5329522; b5=-.7616*b5-w*.0168980;
        d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;
        b6=w*.115926;
      }
    }
    return buf;
  }

  setVolume(v){SETTINGS.vol=v;if(this.master)this.master.gain.value=v;saveSettings()}
  resume(){if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume()}

  throttle(name,min){
    const t=performance.now()/1000;
    if(this._last[name]&&t-this._last[name]<min)return false;
    this._last[name]=t;return true;
  }

  /** HRTF panner with distance rolloff. */
  panner(pos){
    const p=this.ctx.createPanner();
    p.panningModel="HRTF";
    p.distanceModel="inverse";
    p.refDistance=5;p.maxDistance=140;p.rolloffFactor=1.25;
    if(p.positionX){p.positionX.value=pos.x;p.positionY.value=pos.y;p.positionZ.value=pos.z}
    else p.setPosition(pos.x,pos.y,pos.z);
    return p;
  }

  /** Rough distance from the listener, for air absorption. */
  distanceTo(pos){
    const cam=GFX&&GFX.camera;
    if(!cam||!pos)return 0;
    const dx=pos.x-cam.position.x,dy=pos.y-cam.position.y,dz=pos.z-cam.position.z;
    return Math.sqrt(dx*dx+dy*dy+dz*dz);
  }

  play(name,opt={}){
    if(!this.ctx)return;
    const def=SOUND_DEFS[name];
    if(!def)return;
    if(!opt.force&&!this.throttle(name,opt.minGap!==undefined?opt.minGap:(def.ui?.02:.03)))return;

    const c=this.ctx, t0=c.currentTime+(opt.delay||0);
    const bus=def.ui?this.ui:this.sfx;

    // Per-play variation. Without this every shot is bit-identical and the ear
    // hears a loop rather than a weapon.
    const jit=def.jitter===undefined?.06:def.jitter;
    const rate=(opt.rate||1)*(1+U.rand(-jit,jit));
    const vol=(opt.vol!==undefined?opt.vol:1)*(def.v||1);

    // Node the layers feed. Positional sounds get a panner and, further away,
    // progressively less high end.
    let head=c.createGain();
    head.gain.value=1;
    let tail=head;

    if(opt.pos&&!def.ui){
      const dist=this.distanceTo(opt.pos);
      if(dist>3){
        const air=c.createBiquadFilter();
        air.type="lowpass";
        air.frequency.value=U.clamp(19000-dist*dist*4.2,700,19000);
        tail.connect(air);tail=air;
      }
      const pn=this.panner(opt.pos);
      tail.connect(pn);tail=pn;
    }
    tail.connect(bus);

    // Reverb send, scaled by how reflective this sound should be.
    const send=opt.rev!==undefined?opt.rev:(def.rev||0);
    if(send>0&&this.conv){
      const sg=c.createGain();
      sg.gain.value=send;
      tail.connect(sg);
      sg.connect(this.conv);
    }

    for(const L of def.layers)this.layer(L,t0+(L.delay||0)*rate,vol,rate,head);
  }

  layer(L,t0,vol,rate,dest){
    const c=this.ctx;
    const g=c.createGain();
    let head=g;

    if(L.ft){
      const f=c.createBiquadFilter();
      f.type=L.ft;
      f.frequency.setValueAtTime(Math.max(20,L.ff0),t0);
      if(L.ff1!==undefined)f.frequency.exponentialRampToValueAtTime(Math.max(20,L.ff1),t0+L.dur);
      f.Q.value=L.q||1;
      f.connect(g);head=f;
    }
    g.connect(dest);

    const dur=L.dur;
    const peak=Math.max(.0001,(L.g0||.5)*vol);
    const end=Math.max(.0001,(L.g1===undefined?.001:L.g1)*vol);
    const atk=L.atk||.002;

    // Short attack ramp rather than an instant jump -- an instant jump is a
    // click, which is exactly what the old engine produced on every layer.
    g.gain.setValueAtTime(.0001,t0);
    g.gain.linearRampToValueAtTime(peak,t0+Math.min(atk,dur*.5));
    if(L.hold)g.gain.setValueAtTime(peak,t0+Math.min(L.hold,dur*.9));
    g.gain.exponentialRampToValueAtTime(end,t0+dur);

    let src;
    if(L.t==="n"){
      src=c.createBufferSource();
      src.buffer=this.noise[L.nz||"white"]||this.noise.white;
      src.loop=true;
      src.playbackRate.value=rate*(L.pr||1);
    }else{
      src=c.createOscillator();
      src.type=L.w||"sine";
      const f0=Math.max(20,(L.f0||220)*(L.noPitch?1:rate));
      const f1=Math.max(20,(L.f1===undefined?L.f0:L.f1)*(L.noPitch?1:rate));
      src.frequency.setValueAtTime(f0,t0);
      if(f1!==f0)src.frequency.exponentialRampToValueAtTime(f1,t0+dur);
      if(L.det)src.detune.value=L.det;
    }
    src.connect(head);
    src.start(t0);
    src.stop(t0+dur+.08);
  }

  tone(freq,dur,wave,vol,when,slide,bus){
    if(!this.ctx)return;
    const c=this.ctx,t0=c.currentTime+(when||0);
    const o=c.createOscillator(),g=c.createGain();
    o.type=wave||"sine";
    o.frequency.setValueAtTime(freq,t0);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t0+dur);
    g.gain.setValueAtTime(.0001,t0);
    g.gain.linearRampToValueAtTime(vol||.2,t0+.01);
    g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    o.connect(g);g.connect(bus||this.sfx);
    o.start(t0);o.stop(t0+dur+.05);
  }

  startCharge(){}
  stopCharge(){}

  heartbeat(){
    if(!this.ctx)return;
    this.tone(52,.16,"sine",.45,0,34);
    this.tone(46,.20,"sine",.34,.21,30);
  }

  fanfare(win){
    if(!this.ctx)return;
    // Perfect fifths up for a win, a falling minor line for a loss.
    const seq=win?[294,392,494,587,784]:[392,330,262,196];
    seq.forEach((f,i)=>{
      this.tone(f,.55,"triangle",.16,i*.14,undefined,this.mus);
      this.tone(f*2,.42,"sine",.05,i*.14,undefined,this.mus);
      this.tone(f/2,.70,"sine",.07,i*.14,undefined,this.mus);
    });
  }

  // ==========================================================================
  // Ambience
  // ==========================================================================
  ambient(key){
    this.stopAmbient();
    if(!this.ctx)return;
    const c=this.ctx,nodes=[],t0=c.currentTime;

    const wind=(cut,gain,rateHz,depth,nz)=>{
      const n=c.createBufferSource();
      n.buffer=this.noise[nz||"pink"];n.loop=true;
      const f=c.createBiquadFilter();
      f.type="lowpass";f.frequency.value=cut;f.Q.value=.6;
      const g=c.createGain();
      g.gain.setValueAtTime(.0001,t0);
      g.gain.linearRampToValueAtTime(gain,t0+3);
      // Slow swell so it breathes instead of sitting flat.
      const lfo=c.createOscillator(),lg=c.createGain();
      lfo.type="sine";lfo.frequency.value=rateHz;lg.gain.value=depth;
      lfo.connect(lg);lg.connect(g.gain);lfo.start();
      n.connect(f);f.connect(g);g.connect(this.amb);n.start();
      nodes.push(n,lfo);
    };

    const drone=(f,gain,type)=>{
      const o=c.createOscillator(),g=c.createGain(),fl=c.createBiquadFilter();
      o.type=type||"sine";o.frequency.value=f;
      fl.type="lowpass";fl.frequency.value=520;
      g.gain.setValueAtTime(.0001,t0);
      g.gain.linearRampToValueAtTime(gain,t0+4);
      o.connect(fl);fl.connect(g);g.connect(this.amb);o.start();
      nodes.push(o);
    };

    if(key==="desert"){
      wind(420,.055,.043,.022,"pink");     // high sand hiss
      wind(150,.075,.027,.03,"brown");     // low body of the wind
      drone(58,.020,"sine");
      drone(87,.012,"sine");
    }else if(key==="industrial"){
      wind(180,.07,.05,.02,"brown");
      drone(55,.03,"sawtooth");
    }else{
      wind(300,.05,.04,.02,"pink");
      drone(110,.02,"sine");
    }
    this._amb={nodes};
  }

  stopAmbient(){
    if(!this._amb)return;
    for(const n of this._amb.nodes){try{n.stop()}catch(e){}}
    this._amb=null;
  }

  // ==========================================================================
  // Music
  // ==========================================================================
  /**
   * Procedural score. `menu` is a slow, wide pad over a pedal tone; `tension`
   * adds a pulse and tightens the harmony for a planted bomb.
   * @param {"menu"|"tension"|null} key pass null to stop
   */
  music(key){
    this.stopMusic();
    if(!this.ctx||!key)return;
    const c=this.ctx,t0=c.currentTime,nodes=[],timers=[];

    const out=c.createGain();
    out.gain.setValueAtTime(.0001,t0);
    out.gain.linearRampToValueAtTime(1,t0+3.5);
    out.connect(this.mus);
    // A little space on the music too, so it sits behind the game.
    if(this.conv){
      const sg=c.createGain();sg.gain.value=.28;
      out.connect(sg);sg.connect(this.conv);
    }

    /** One sustained voice with slow vibrato and a lowpass. */
    const voice=(freq,gain,type,cut,detune)=>{
      const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
      o.type=type||"sawtooth";o.frequency.value=freq;
      if(detune)o.detune.value=detune;
      f.type="lowpass";f.frequency.value=cut||700;f.Q.value=.7;
      g.gain.value=gain;
      const lfo=c.createOscillator(),lg=c.createGain();
      lfo.frequency.value=.07+Math.random()*.05;lg.gain.value=gain*.35;
      lfo.connect(lg);lg.connect(g.gain);lfo.start();
      o.connect(f);f.connect(g);g.connect(out);o.start();
      nodes.push(o,lfo);
      return {o,g,f};
    };

    // D minor pedal -- open, unresolved, sits under a menu without demanding
    // attention.
    const root=key==="tension"?61.74:58.27;          // B1-ish / A#1-ish
    voice(root,.10,"sine",240);
    voice(root*2,.055,"triangle",520,-6);
    voice(root*3,.030,"sawtooth",700,+7);
    voice(root*4.7565,.022,"sine",900);              // a distant fifth above

    if(key==="menu"){
      // Sparse bell motif, wandering so it never sounds like a loop point.
      const scale=[0,3,5,7,10,12,15];
      const bell=()=>{
        const semi=scale[Math.floor(Math.random()*scale.length)]+12;
        const f=root*Math.pow(2,semi/12)*2;
        this.tone(f,2.4,"sine",.045,0,undefined,out);
        this.tone(f*2.002,1.6,"sine",.016,.01,undefined,out);
        timers.push(setTimeout(bell,1800+Math.random()*2600));
      };
      timers.push(setTimeout(bell,1200));
    }else{
      // Tension: a slow heartbeat pulse that tightens as the fuse runs down.
      const pulse=()=>{
        this.tone(root*2,.20,"triangle",.07,0,root*1.6,out);
        timers.push(setTimeout(pulse,760));
      };
      timers.push(setTimeout(pulse,300));
    }

    this._music={nodes,timers,out};
  }

  stopMusic(){
    if(!this._music)return;
    const {nodes,timers,out}=this._music;
    this._music=null;
    for(const t of timers)clearTimeout(t);
    const c=this.ctx;
    try{
      out.gain.cancelScheduledValues(c.currentTime);
      out.gain.setValueAtTime(out.gain.value,c.currentTime);
      out.gain.exponentialRampToValueAtTime(.0001,c.currentTime+1.2);
    }catch(e){}
    setTimeout(()=>{for(const n of nodes){try{n.stop()}catch(e){}}},1400);
  }

  updateListener(cam){
    if(!this.ctx||!cam)return;
    const l=this.ctx.listener;
    _vd.set(0,0,-1).applyQuaternion(cam.quaternion);
    _ve.set(0,1,0).applyQuaternion(cam.quaternion);
    if(l.positionX){
      const t=this.ctx.currentTime;
      l.positionX.setTargetAtTime(cam.position.x,t,.01);
      l.positionY.setTargetAtTime(cam.position.y,t,.01);
      l.positionZ.setTargetAtTime(cam.position.z,t,.01);
      l.forwardX.value=_vd.x;l.forwardY.value=_vd.y;l.forwardZ.value=_vd.z;
      l.upX.value=_ve.x;l.upY.value=_ve.y;l.upZ.value=_ve.z;
    }else{
      l.setPosition(cam.position.x,cam.position.y,cam.position.z);
      l.setOrientation(_vd.x,_vd.y,_vd.z,_ve.x,_ve.y,_ve.z);
    }
  }
}

// ===========================================================================
// Sound definitions
//
// Gunfire is built from three parts, which is what makes it read as a firearm:
//   crack  - very short, very bright noise transient (the supersonic snap)
//   body   - a fast downward pitch sweep (the muzzle blast)
//   tail   - longer filtered noise sent to the reverb (the room answering)
// ===========================================================================
const gun=(o)=>({
  v:o.v||1, rev:o.rev===undefined?.45:o.rev, jitter:o.jitter===undefined?.07:o.jitter,
  layers:[
    {t:"n",nz:"white",dur:o.crackDur||.035,g0:o.crack||.85,g1:.001,
     ft:"bandpass",ff0:o.crackF||3800,ff1:(o.crackF||3800)*.35,q:.8,atk:.0008},
    {t:"o",w:o.wave||"square",f0:o.f0||190,f1:o.f1||42,dur:o.bodyDur||.10,
     g0:o.body||.75,g1:.001,ft:"lowpass",ff0:2600,ff1:400,atk:.001},
    {t:"o",w:"sine",f0:(o.f0||190)*.5,f1:(o.f1||42)*.6,dur:(o.bodyDur||.10)*1.5,
     g0:(o.body||.75)*.55,g1:.001,atk:.002},
    {t:"n",nz:"pink",dur:o.tailDur||.26,g0:o.tail||.22,g1:.0008,
     ft:"lowpass",ff0:o.tailF||1500,ff1:220,q:.5,atk:.006,delay:.012}
  ]
});

const SOUND_DEFS={
  // --- weapons -------------------------------------------------------------
  shot_rifle:     gun({crack:.9,crackF:4200,f0:200,f1:44,body:.8,tail:.24,tailF:1700,rev:.5}),
  shot_rifle_sil: gun({crack:.32,crackF:2600,crackDur:.028,f0:150,f1:52,body:.34,
                       bodyDur:.07,tail:.10,tailF:900,tailDur:.16,rev:.22,v:.8}),
  shot_smg:       gun({crack:.7,crackF:4600,crackDur:.026,f0:230,f1:58,body:.6,
                       bodyDur:.07,tail:.16,tailF:1900,tailDur:.18,rev:.4}),
  shot_pistol:    gun({crack:.75,crackF:3900,f0:210,f1:50,body:.62,bodyDur:.08,
                       tail:.18,tailF:1500,tailDur:.2,rev:.42}),
  shot_pistol_sil:gun({crack:.26,crackF:2200,crackDur:.03,f0:130,f1:56,body:.3,
                       bodyDur:.065,tail:.08,tailF:760,tailDur:.14,rev:.2,v:.78}),
  shot_deagle:    gun({crack:1,crackF:3400,crackDur:.045,f0:150,f1:34,body:1,
                       bodyDur:.14,tail:.3,tailF:1300,tailDur:.36,rev:.58,v:1.05}),
  shot_awp:       gun({crack:1,crackF:3000,crackDur:.055,wave:"sawtooth",f0:130,f1:28,
                       body:1,bodyDur:.18,tail:.34,tailF:1100,tailDur:.55,rev:.7,v:1.1}),
  shot_shotgun:   gun({crack:.95,crackF:2400,crackDur:.06,wave:"sawtooth",f0:120,f1:30,
                       body:.9,bodyDur:.16,tail:.3,tailF:1000,tailDur:.42,rev:.6,v:1.05}),

  knife_slash:{v:.7,rev:.2,jitter:.12,layers:[
    {t:"n",nz:"white",dur:.13,g0:.4,g1:.001,ft:"bandpass",ff0:5200,ff1:1400,q:1.6,atk:.004}]},
  knife_hit:{v:.9,rev:.3,jitter:.1,layers:[
    {t:"n",nz:"white",dur:.06,g0:.6,g1:.001,ft:"bandpass",ff0:2600,ff1:700,q:1.1},
    {t:"o",w:"triangle",f0:180,f1:70,dur:.09,g0:.4,g1:.001}]},

  dry:{v:.6,ui:false,rev:.1,jitter:.03,layers:[
    {t:"n",nz:"white",dur:.03,g0:.4,g1:.001,ft:"highpass",ff0:2400,ff1:3000,q:.8},
    {t:"o",w:"square",f0:1100,f1:700,dur:.025,g0:.12,g1:.001}]},

  reload1:{v:.75,rev:.25,jitter:.05,layers:[
    {t:"n",nz:"white",dur:.07,g0:.32,g1:.001,ft:"bandpass",ff0:1800,ff1:600,q:1.4},
    {t:"o",w:"square",f0:320,f1:160,dur:.06,g0:.16,g1:.001}]},
  reload2:{v:.8,rev:.28,jitter:.05,layers:[
    {t:"n",nz:"white",dur:.09,g0:.38,g1:.001,ft:"bandpass",ff0:1300,ff1:420,q:1.2},
    {t:"o",w:"square",f0:220,f1:110,dur:.08,g0:.2,g1:.001},
    {t:"o",w:"sine",f0:120,f1:70,dur:.12,g0:.14,g1:.001,delay:.05}]},

  // --- impacts -------------------------------------------------------------
  hit:{v:.7,ui:false,rev:.2,jitter:.1,layers:[
    {t:"n",nz:"white",dur:.05,g0:.45,g1:.001,ft:"bandpass",ff0:1600,ff1:500,q:1.1},
    {t:"o",w:"sine",f0:220,f1:90,dur:.07,g0:.3,g1:.001}]},
  hit_head:{v:.9,ui:false,rev:.22,jitter:.06,layers:[
    {t:"n",nz:"white",dur:.05,g0:.5,g1:.001,ft:"bandpass",ff0:3400,ff1:900,q:1.4},
    {t:"o",w:"triangle",f0:900,f1:360,dur:.09,g0:.32,g1:.001}]},
  hurt:{v:.85,rev:.15,jitter:.08,layers:[
    {t:"o",w:"sine",f0:180,f1:80,dur:.22,g0:.34,g1:.001},
    {t:"n",nz:"brown",dur:.18,g0:.2,g1:.001,ft:"lowpass",ff0:900,ff1:280}]},
  kill:{v:.8,ui:true,jitter:0,layers:[
    {t:"o",w:"triangle",f0:880,f1:1320,dur:.10,g0:.22,g1:.001,noPitch:true},
    {t:"o",w:"sine",f0:1320,f1:1760,dur:.12,g0:.14,g1:.001,delay:.06,noPitch:true}]},

  // --- explosives ----------------------------------------------------------
  explosion:{v:1.1,rev:.8,jitter:.09,layers:[
    {t:"n",nz:"white",dur:.09,g0:1,g1:.001,ft:"bandpass",ff0:2600,ff1:400,q:.5,atk:.001},
    {t:"o",w:"sawtooth",f0:110,f1:24,dur:.34,g0:.95,g1:.001,ft:"lowpass",ff0:1400,ff1:120},
    {t:"o",w:"sine",f0:60,f1:22,dur:.6,g0:.7,g1:.001},
    {t:"n",nz:"brown",dur:1.0,g0:.4,g1:.0008,ft:"lowpass",ff0:900,ff1:110,atk:.02,delay:.03}]},
  heboom:{v:1.15,rev:.85,jitter:.07,layers:[
    {t:"n",nz:"white",dur:.07,g0:1,g1:.001,ft:"highpass",ff0:1800,ff1:600,atk:.0008},
    {t:"o",w:"sawtooth",f0:130,f1:26,dur:.30,g0:1,g1:.001,ft:"lowpass",ff0:1800,ff1:140},
    {t:"o",w:"sine",f0:52,f1:20,dur:.85,g0:.8,g1:.001},
    {t:"n",nz:"brown",dur:1.3,g0:.42,g1:.0008,ft:"lowpass",ff0:800,ff1:90,atk:.03,delay:.04}]},
  flashpop:{v:1.1,rev:.7,jitter:.05,layers:[
    {t:"n",nz:"white",dur:.05,g0:1,g1:.001,ft:"highpass",ff0:3200,ff1:1400,atk:.0006},
    {t:"o",w:"sine",f0:2400,f1:400,dur:.18,g0:.4,g1:.001},
    {t:"n",nz:"pink",dur:1.6,g0:.24,g1:.0008,ft:"bandpass",ff0:3000,ff1:2600,q:6,atk:.01}]},
  smokehiss:{v:.85,rev:.35,jitter:.04,layers:[
    {t:"n",nz:"white",dur:2.6,g0:.34,g1:.001,ft:"bandpass",ff0:2800,ff1:900,q:.8,atk:.05}]},
  fireignite:{v:.9,rev:.4,jitter:.06,layers:[
    {t:"n",nz:"white",dur:.5,g0:.5,g1:.001,ft:"bandpass",ff0:1400,ff1:500,q:.7,atk:.01},
    {t:"o",w:"sawtooth",f0:80,f1:40,dur:.4,g0:.3,g1:.001,ft:"lowpass",ff0:600,ff1:200}]},
  firecrack:{v:.5,rev:.3,jitter:.2,layers:[
    {t:"n",nz:"pink",dur:.16,g0:.24,g1:.001,ft:"bandpass",ff0:1900,ff1:700,q:1.2,atk:.004}]},
  pin:{v:.6,rev:.2,jitter:.05,layers:[
    {t:"o",w:"square",f0:1500,f1:1100,dur:.05,g0:.16,g1:.001},
    {t:"n",nz:"white",dur:.04,g0:.2,g1:.001,ft:"highpass",ff0:3000,ff1:2400}]},
  nadebounce:{v:.6,rev:.35,jitter:.16,layers:[
    {t:"o",w:"triangle",f0:420,f1:180,dur:.09,g0:.22,g1:.001},
    {t:"n",nz:"white",dur:.05,g0:.18,g1:.001,ft:"bandpass",ff0:2400,ff1:900,q:1.5}]},

  // --- movement ------------------------------------------------------------
  step_dirt:{v:.55,rev:.3,jitter:.22,layers:[
    {t:"n",nz:"pink",dur:.10,g0:.30,g1:.001,ft:"bandpass",ff0:1500,ff1:420,q:.9,atk:.004},
    {t:"n",nz:"brown",dur:.07,g0:.18,g1:.001,ft:"lowpass",ff0:500,ff1:180}]},
  step_metal:{v:.55,rev:.4,jitter:.18,layers:[
    {t:"n",nz:"white",dur:.08,g0:.26,g1:.001,ft:"bandpass",ff0:3200,ff1:1100,q:1.4,atk:.002},
    {t:"o",w:"triangle",f0:520,f1:240,dur:.06,g0:.12,g1:.001}]},
  step_grate:{v:.55,rev:.4,jitter:.18,layers:[
    {t:"n",nz:"white",dur:.09,g0:.28,g1:.001,ft:"bandpass",ff0:2600,ff1:800,q:1.2,atk:.002}]},
  jump:{v:.5,rev:.2,jitter:.1,layers:[
    {t:"n",nz:"pink",dur:.08,g0:.2,g1:.001,ft:"lowpass",ff0:1200,ff1:400},
    {t:"o",w:"sine",f0:200,f1:320,dur:.09,g0:.12,g1:.001}]},
  land:{v:.8,rev:.3,jitter:.12,layers:[
    {t:"n",nz:"brown",dur:.14,g0:.42,g1:.001,ft:"lowpass",ff0:900,ff1:180,atk:.003},
    {t:"o",w:"sine",f0:130,f1:55,dur:.16,g0:.3,g1:.001}]},
  spawn:{v:.6,rev:.4,jitter:0,layers:[
    {t:"o",w:"sine",f0:220,f1:440,dur:.28,g0:.18,g1:.001,noPitch:true},
    {t:"o",w:"triangle",f0:440,f1:660,dur:.22,g0:.08,g1:.001,delay:.06,noPitch:true}]},

  // --- interface -----------------------------------------------------------
  beep:{v:.7,ui:true,jitter:0,layers:[
    {t:"o",w:"sine",f0:880,f1:880,dur:.09,g0:.2,g1:.001,noPitch:true},
    {t:"o",w:"sine",f0:1760,f1:1760,dur:.06,g0:.05,g1:.001,noPitch:true}]},
  ui_click:{v:.6,ui:true,jitter:.03,layers:[
    {t:"o",w:"sine",f0:1200,f1:1500,dur:.045,g0:.13,g1:.001},
    {t:"n",nz:"white",dur:.02,g0:.07,g1:.001,ft:"highpass",ff0:4000,ff1:5000}]},
  ui_back:{v:.6,ui:true,jitter:.03,layers:[
    {t:"o",w:"sine",f0:900,f1:620,dur:.06,g0:.13,g1:.001}]},
  buy:{v:.75,ui:true,jitter:0,layers:[
    {t:"o",w:"triangle",f0:660,f1:990,dur:.10,g0:.16,g1:.001,noPitch:true},
    {t:"o",w:"sine",f0:1320,f1:1560,dur:.09,g0:.07,g1:.001,delay:.05,noPitch:true}]},
  pk_ammo:{v:.7,ui:true,jitter:0,layers:[
    {t:"o",w:"square",f0:740,f1:980,dur:.09,g0:.14,g1:.001,noPitch:true}]},
  pk_power:{v:.8,ui:true,jitter:0,layers:[
    {t:"o",w:"triangle",f0:520,f1:1040,dur:.22,g0:.16,g1:.001,noPitch:true}]}
};

export {SOUND_DEFS};
