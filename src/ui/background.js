// Animated menu backdrop.
//
// A canvas2D parallax scene: layered dunes drifting at different speeds, a low
// sun with heat haze, dust motes on the wind, and a slow horizontal pan. Cheap
// enough to leave running behind the menu (it throttles itself when hidden)
// and it sets the tone before the map has even loaded.
import {U} from '../core/util.js';

export class MenuBackground{
  constructor(canvas){
    this.c=canvas;
    this.g=canvas.getContext("2d");
    this.t=0;
    this.running=false;
    this.motes=[];
    this.dunes=[];
    this._onResize=()=>this.resize();
    this.resize();
    this.seed();
  }

  seed(){
    const R=U.mulberry(0x5EED);
    // Four dune bands: farther bands are lighter, hazier and drift slower.
    this.dunes=[];
    for(let i=0;i<4;i++){
      const pts=[];
      const n=14;
      for(let k=0;k<=n;k++)pts.push(R());
      this.dunes.push({
        pts,
        depth:i,
        speed:.006+i*.012,
        amp:.045+i*.035,
        base:.52+i*.09,
        offset:R()*1000
      });
    }
    this.motes=[];
    for(let i=0;i<90;i++){
      this.motes.push({
        x:R(),y:R(),
        z:.25+R()*.75,          // parallax depth
        r:.4+R()*1.7,
        drift:R()*6.28,
        sp:.02+R()*.05
      });
    }
  }

  resize(){
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const w=this.c.clientWidth||window.innerWidth;
    const h=this.c.clientHeight||window.innerHeight;
    this.c.width=Math.max(2,Math.round(w*dpr));
    this.c.height=Math.max(2,Math.round(h*dpr));
    this.g.setTransform(dpr,0,0,dpr,0,0);
    this.w=w;this.h=h;
  }

  start(){
    if(this.running)return;
    this.running=true;
    addEventListener("resize",this._onResize);
    this.last=performance.now();
    const loop=now=>{
      if(!this.running)return;
      const dt=Math.min(.05,(now-this.last)/1000);
      this.last=now;
      this.t+=dt;
      this.draw(dt);
      this._raf=requestAnimationFrame(loop);
    };
    this._raf=requestAnimationFrame(loop);
  }

  stop(){
    this.running=false;
    if(this._raf)cancelAnimationFrame(this._raf);
    removeEventListener("resize",this._onResize);
  }

  /** Dune silhouette: a smooth sine chain sampled from the seeded points. */
  duneY(d,x){
    const n=d.pts.length-1;
    const f=(x*1.4+d.offset+this.t*d.speed)%1;
    const i=Math.floor(f*n);
    const t=f*n-i;
    const a=d.pts[i%n],b=d.pts[(i+1)%n];
    const s=t*t*(3-2*t);
    return U.lerp(a,b,s);
  }

  draw(dt){
    const g=this.g,w=this.w,h=this.h;
    if(!w||!h)return;

    // --- sky ---------------------------------------------------------------
    const sky=g.createLinearGradient(0,0,0,h);
    sky.addColorStop(0,   "#2c3d5c");
    sky.addColorStop(.42, "#7d7a76");
    sky.addColorStop(.68, "#c99a63");
    sky.addColorStop(1,   "#e0b478");
    g.fillStyle=sky;g.fillRect(0,0,w,h);

    // --- sun with a breathing halo ----------------------------------------
    const sx=w*.72, sy=h*.60;
    const pulse=1+Math.sin(this.t*.5)*.05;
    const halo=g.createRadialGradient(sx,sy,0,sx,sy,h*.42*pulse);
    halo.addColorStop(0,  "rgba(255,232,180,.85)");
    halo.addColorStop(.18,"rgba(255,206,132,.42)");
    halo.addColorStop(.55,"rgba(226,158,92,.14)");
    halo.addColorStop(1,  "rgba(226,158,92,0)");
    g.fillStyle=halo;g.fillRect(0,0,w,h);
    g.fillStyle="rgba(255,244,214,.92)";
    g.beginPath();g.arc(sx,sy,h*.035,0,7);g.fill();

    // --- dunes, far to near ------------------------------------------------
    for(const d of this.dunes){
      const shade=28+d.depth*16;
      const alpha=.30+d.depth*.20;
      g.beginPath();
      g.moveTo(0,h);
      const steps=64;
      for(let i=0;i<=steps;i++){
        const x=i/steps;
        const y=(d.base-this.duneY(d,x)*d.amp)*h;
        i?g.lineTo(x*w,y):g.lineTo(0,y);
      }
      g.lineTo(w,h);g.closePath();
      const dg=g.createLinearGradient(0,d.base*h-40,0,h);
      dg.addColorStop(0,`rgba(${shade+96},${shade+72},${shade+42},${alpha})`);
      dg.addColorStop(1,`rgba(${shade+52},${shade+38},${shade+22},${Math.min(1,alpha+.35)})`);
      g.fillStyle=dg;
      g.fill();
    }

    // --- wind-blown dust ---------------------------------------------------
    for(const m of this.motes){
      m.x+=(m.sp*m.z)*dt;
      m.drift+=dt*.6;
      if(m.x>1.05)m.x-=1.1;
      const px=m.x*w;
      const py=(m.y*.85+.08)*h+Math.sin(m.drift)*6*m.z;
      g.fillStyle=`rgba(255,238,206,${.05+m.z*.13})`;
      g.beginPath();g.arc(px,py,m.r*m.z*1.6,0,7);g.fill();
    }

    // --- heat shimmer near the horizon ------------------------------------
    const shimmerY=h*.56;
    g.save();
    g.globalAlpha=.05;
    for(let i=0;i<5;i++){
      const off=Math.sin(this.t*1.6+i)*3;
      g.fillStyle="#fff0d0";
      g.fillRect(0,shimmerY+i*7+off,w,2);
    }
    g.restore();

    // --- vignette ----------------------------------------------------------
    const vg=g.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.28,w*.5,h*.5,Math.max(w,h)*.78);
    vg.addColorStop(0,"rgba(0,0,0,0)");
    vg.addColorStop(1,"rgba(8,7,6,.72)");
    g.fillStyle=vg;g.fillRect(0,0,w,h);
  }
}
