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

  /**
   * Two nodes link when you could actually walk between them.
   *
   * This used to compare each sample against a straight LINE interpolated
   * between the two node heights, and reject anything more than ~0.7m off it.
   * Across ramps and steps that fails constantly, and the graph came out
   * shattered -- only 32 of 349 nodes were mutually reachable, so bots could
   * not path to most of the map at all. Following the floor from one sample to
   * the next instead asks the right question: is every step from here a step
   * you could take?
   */
  // One definition of walkability, shared with the runtime graph and the bots
  // themselves (see SpanField.walkableBetween) so they cannot disagree.
  const clear=(a,c)=>spans.walkableBetween(
    {x:a.x,y:a.y-.06,z:a.z},{x:c.x,y:c.y-.06,z:c.z},
    CFG.stepMax,CFG.standHeight);

  for(let i=0;i<idxs.length;i++){
    const a=b.navDefs[idxs[i]].p;
    for(let j=i+1;j<idxs.length;j++){
      const c=b.navDefs[idxs[j]].p;
      const dx=a.x-c.x,dz=a.z-c.z,dy=Math.abs(a.y-c.y);
      if(dx*dx+dz*dz>LINK_R2||dy>LINK_DY)continue;
      if(clear(a,c))b.link(idxs[i],idxs[j]);
    }
  }

  // --- connectivity ------------------------------------------------------
  // Even with a good link test, doorways and stairs can leave islands. Find the
  // connected components and stitch each one to the main body at its closest
  // reachable pair, so a bot can always path to anywhere it can stand.
  {
    const n=b.navDefs.length;
    const adj=new Array(n);
    for(let i=0;i<n;i++)adj[i]=[];
    for(const [i,j] of b.navLinks){adj[i].push(j);adj[j].push(i)}

    const comp=new Int32Array(n).fill(-1);
    const sizes=[];
    for(let i=0;i<n;i++){
      if(comp[i]>=0)continue;
      const id=sizes.length;
      let count=0;
      const q=[i];comp[i]=id;
      while(q.length){
        const cur=q.pop();count++;
        for(const k of adj[cur])if(comp[k]<0){comp[k]=id;q.push(k)}
      }
      sizes.push(count);
    }

    if(sizes.length>1){
      let main=0;
      for(let i=1;i<sizes.length;i++)if(sizes[i]>sizes[main])main=i;
      for(let cid=0;cid<sizes.length;cid++){
        if(cid===main)continue;
        // Closest pair between this island and the main body.
        let bi=-1,bj=-1,bd=1e9;
        for(let i=0;i<n;i++){
          if(comp[i]!==cid)continue;
          const pi=b.navDefs[i].p;
          for(let j=0;j<n;j++){
            if(comp[j]!==main)continue;
            const d=pi.distanceToSquared(b.navDefs[j].p);
            if(d<bd){bd=d;bi=i;bj=j}
          }
        }
        // Only bridge a gap a body could actually walk. Linking islands on
        // distance alone produces routes through solid walls, and a bot that
        // trusts one walks into the wall and stays there.
        if(bi>=0&&bd<14*14){
          const pa=b.navDefs[bi].p, pb=b.navDefs[bj].p;
          if(spans.walkableBetween({x:pa.x,y:pa.y-.06,z:pa.z},
                                   {x:pb.x,y:pb.y-.06,z:pb.z},
                                   CFG.stepMax,CFG.standHeight)){
            b.link(bi,bj);
            for(let i=0;i<n;i++)if(comp[i]===cid)comp[i]=main;
          }
        }
      }
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

  // Spawn points. The map authors five per side; larger matches need more, so
  // each authored point is expanded into a small cluster of nearby positions
  // that are validated against the collision field. Without this a 10v10
  // starts with bots stacked two-deep on the same spot.
  const mkSpawn=(arr,team,yaw)=>{
    if(!arr)return;
    const placed=[];
    const tryPlace=(x,z)=>{
      const f=spans.groundFloorAt(x,z);
      if(f<-900)return false;
      const sp=spans.spanAt(x,z,f+.1,CFG.stepMax);
      if(!sp||sp.ceil-sp.floor<CFG.standHeight)return false;
      for(const q of placed)if((q[0]-x)**2+(q[1]-z)**2<1.2*1.2)return false;
      placed.push([x,z]);
      b.spawn(x,f+.12,z,yaw,team);
      return true;
    };
    for(const p of arr)tryPlace(p[0],p[1]);
    // Ring out from each authored point until there is room for a full side.
    const want=12;
    for(let ring=1;ring<=3&&placed.length<want;ring++){
      for(const p of arr){
        if(placed.length>=want)break;
        for(let a=0;a<8&&placed.length<want;a++){
          const ang=a/8*Math.PI*2+ring*.4;
          tryPlace(p[0]+Math.cos(ang)*ring*1.4, p[1]+Math.sin(ang)*ring*1.4);
        }
      }
    }
  };
  mkSpawn(def.spCT,1,def.ctYaw!==undefined?def.ctYaw:-90);
  mkSpawn(def.spT,2,def.tYaw!==undefined?def.tYaw:90);
}
