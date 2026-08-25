// Navigation graph generated from the span field.
// Sampling the spans instead of a flat heightfield means nodes land on every
// storey of the map, and links are rejected when the straight line between two
// nodes would pass through geometry.
import {CFG} from '../core/config.js';
import {U} from '../core/util.js';

const STEP=2.0;              // node spacing
const LINK_R2=90;            // max squared horizontal link distance
const LINK_DY=2.2;           // max height difference for a link

export function buildAutoNav(b,def,spans){
  const aabb=def.aabb;
  const pts=[];

  for(let x=aabb.min[0]+1.6;x<aabb.max[0]-1.2;x+=STEP){
    for(let z=aabb.min[2]+1.6;z<aabb.max[2]-1.2;z+=STEP){
      const ci=spans.idx(x,z);
      if(ci<0)continue;
      const n=spans.count[ci];
      if(!n)continue;
      // A node per storey, provided a body actually fits there.
      for(let k=0;k<n;k++){
        const f=spans.floors[ci*6+k], c=spans.ceils[ci*6+k];
        if(c-f<CFG.standHeight)continue;
        // Reject ledges: if a neighbour drops away sharply this is a rim, not a
        // place a bot should try to stand.
        let drop=0;
        for(const [ox,oz] of [[STEP,0],[-STEP,0],[0,STEP],[0,-STEP]]){
          const nf=spans.floorAt(x+ox,z+oz,f+.3,CFG.stepMax);
          if(nf<-900){drop=99;break}
          const d=f-nf;
          if(d>drop)drop=d;
        }
        if(drop>1.4)continue;
        pts.push(new THREE.Vector3(x,f+.06,z));
      }
    }
  }

  const idxs=pts.map(p=>b.nav(p.x,p.y,p.z,{}));
  if(!idxs.length)return;

  const ys=idxs.map(i=>b.navDefs[i].p.y).slice().sort((a,c)=>a-c);
  const medY=ys[Math.floor(ys.length/2)]||0;

  // Two nodes link when a walkable corridor connects them.
  const clear=(a,c)=>{
    const d=Math.hypot(c.x-a.x,c.z-a.z);
    const steps=Math.max(2,Math.ceil(d/1.2));
    for(let i=1;i<steps;i++){
      const t=i/steps;
      const x=a.x+(c.x-a.x)*t, z=a.z+(c.z-a.z)*t, y=a.y+(c.y-a.y)*t;
      const s=spans.spanAt(x,z,y+.3,CFG.stepMax+.2);
      if(!s)return false;
      if(Math.abs(s.floor-y)>CFG.stepMax+.35)return false;
      if(s.ceil-s.floor<CFG.standHeight)return false;
    }
    return true;
  };

  for(let i=0;i<idxs.length;i++){
    const a=b.navDefs[idxs[i]].p;
    for(let j=i+1;j<idxs.length;j++){
      const c=b.navDefs[idxs[j]].p;
      const dx=a.x-c.x,dz=a.z-c.z,dy=Math.abs(a.y-c.y);
      if(dx*dx+dz*dz>LINK_R2||dy>LINK_DY)continue;
      if(clear(a,c))b.link(idxs[i],idxs[j]);
    }
  }

  for(const i of idxs)if(b.navDefs[i].p.y>medY+2.4)b.navDefs[i].flags.high=true;

  // "hot" nodes are where fights happen -- bombsites and mid. Idle bots prefer
  // these instead of wandering into empty corners.
  if(def.sites)for(const i of idxs){
    const n=b.navDefs[i].p;
    for(const st of def.sites){
      const dx=n.x-st.x,dz=n.z-st.z;
      if(dx*dx+dz*dz<(st.r+3)*(st.r+3)){b.navDefs[i].flags.hot=true;break}
    }
    const mx=def.mid?def.mid[0]:0, mz=def.mid?def.mid[1]:0;
    if((n.x-mx)*(n.x-mx)+(n.z-mz)*(n.z-mz)<40)b.navDefs[i].flags.hot=true;
  }

  const mkSpawn=(arr,team,yaw)=>{
    if(!arr)return;
    for(const p of arr){
      const y=spans.groundFloorAt(p[0],p[1]);
      b.spawn(p[0],(y>-900?y:0)+.12,p[1],yaw,team);
    }
  };
  mkSpawn(def.spCT,1,def.ctYaw!==undefined?def.ctYaw:-90);
  mkSpawn(def.spT,2,def.tYaw!==undefined?def.tYaw:90);
}
