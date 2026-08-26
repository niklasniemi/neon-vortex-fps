// Adaptive render quality.
//
// The renderer was pinned at up to 1.75x device pixel ratio with full bloom and
// a 3072px shadow map, regardless of what the machine could actually sustain.
// On a high-DPI display that is roughly three times the pixels of the window,
// and the post chain runs over all of them -- which is where the "laggy" feel
// came from even though CPU simulation had plenty of headroom.
//
// This watches a rolling median of frame time and walks a small ladder of
// quality levels to hold the target. It steps down quickly when frames are
// being missed and back up slowly, so it settles instead of oscillating.
import {SETTINGS} from '../core/config.js';

/** Quality ladder, cheapest first. */
export const TIERS=[
  {name:"low",    pr:0.75, shadow:1024, shadowOn:true,  bloom:0.45, post:true},
  {name:"medium", pr:1.00, shadow:1536, shadowOn:true,  bloom:0.7,  post:true},
  {name:"high",   pr:1.25, shadow:2048, shadowOn:true,  bloom:1.0,  post:true},
  {name:"ultra",  pr:1.60, shadow:3072, shadowOn:true,  bloom:1.0,  post:true}
];

const TARGET_MS=16.7;
const WINDOW=45;

export class AdaptiveQuality{
  constructor(gfx){
    this.gfx=gfx;
    this.samples=new Float32Array(WINDOW);
    this.n=0;this.filled=false;
    this.tier=2;                 // start at "high" and let it settle
    this.cooldown=0;
    this.enabled=true;
  }

  /** Applies a tier to the renderer. */
  apply(i){
    const t=TIERS[Math.max(0,Math.min(TIERS.length-1,i))];
    const g=this.gfx;
    this.tier=TIERS.indexOf(t);

    const pr=Math.min(t.pr,window.devicePixelRatio||1);
    if(Math.abs(g.renderer.getPixelRatio()-pr)>.01){
      g.renderer.setPixelRatio(pr);
      g.renderer.setSize(innerWidth,innerHeight);
      if(g.composer)g.composer.setSize(innerWidth,innerHeight);
    }
    g.renderer.shadowMap.enabled=t.shadowOn;
    if(g.sun&&g.sun.shadow){
      const m=g.sun.shadow.mapSize;
      if(m.width!==t.shadow){
        m.set(t.shadow,t.shadow);
        // Force three.js to rebuild the shadow target at the new size.
        if(g.sun.shadow.map){g.sun.shadow.map.dispose();g.sun.shadow.map=null}
      }
    }
    if(g.bloom)g.bloom.strength=(g.bloomBase||.32)*SETTINGS.bloomAmt*t.bloom;
    this.current=t;
    return t;
  }

  /** Forces a specific tier and stops auto-adjusting. */
  lock(name){
    const i=TIERS.findIndex(t=>t.name===name);
    if(i<0){this.enabled=true;return}
    this.enabled=false;
    this.apply(i);
  }

  unlock(){this.enabled=true}

  /** Median is used rather than mean so one hitch cannot drag the whole window. */
  median(){
    const n=this.filled?WINDOW:this.n;
    if(n<8)return 0;
    const a=Array.prototype.slice.call(this.samples,0,n).sort((x,y)=>x-y);
    return a[n>>1];
  }

  /** @param {number} dt seconds since the previous frame */
  tick(dt){
    const ms=dt*1000;
    // Ignore obvious stalls (tab switches, GC of a whole level load).
    if(ms<200){
      this.samples[this.n]=ms;
      this.n=(this.n+1)%WINDOW;
      if(this.n===0)this.filled=true;
    }
    if(!this.enabled)return;
    this.cooldown-=dt;
    if(this.cooldown>0)return;

    const med=this.median();
    if(!med)return;

    if(med>TARGET_MS*1.12&&this.tier>0){
      this.apply(this.tier-1);
      this.cooldown=1.2;               // let it settle before judging again
      this.n=0;this.filled=false;
    }else if(med<TARGET_MS*0.72&&this.tier<TIERS.length-1){
      this.apply(this.tier+1);
      this.cooldown=3.5;               // climb back slowly
      this.n=0;this.filled=false;
    }
  }

  status(){
    const med=this.median();
    return {tier:this.current?this.current.name:"?",
            medianMs:+med.toFixed(2),
            fps:med?Math.round(1000/med):0};
  }
}
