// Span-field world collision.
//
// The previous build stored ONE height per cell -- and picked the *lowest*
// upward-facing surface it found, so the top of a wall was never recorded and a
// ceiling was never recorded at all. Result: you could walk through walls and
// jump through roofs.
//
// This stores, per cell, the full stack of free vertical spans:
//
//     ceil  ---------   <- underside of the geometry above (down-facing normal)
//           (free)
//     floor =========   <- walkable surface (up-facing normal)
//           #########   solid
//     ceil  ---------
//           (free)
//     floor =========
//
// A downward ray alternates top-of-solid (normal +Y) and bottom-of-solid
// (normal -Y). Walking the hits from the sky down and pairing them yields the
// spans directly. From that we can answer "what do I stand on here", "what is
// above my head", and "does my body even fit" -- which is everything the
// character controller needs.

import {U} from '../core/util.js';

export const SPAN_CELL=.35;      // finer than the old .5 -- catches thin pillars
const MAX_SPANS=6;               // Dust II never stacks more than a few levels
const UP_N=.35;                  // |normal.y| above this counts as floor/ceiling

export class SpanField{
  constructor(aabb){
    this.minX=aabb.min[0];this.minZ=aabb.min[2];
    this.minY=aabb.min[1];this.maxY=aabb.max[1];
    this.cell=SPAN_CELL;
    this.cols=Math.max(2,Math.ceil((aabb.max[0]-aabb.min[0])/this.cell));
    this.rows=Math.max(2,Math.ceil((aabb.max[2]-aabb.min[2])/this.cell));
    // Flat typed arrays: floors[cell*MAX_SPANS+i] / ceils[...]. Avoids tens of
    // thousands of little JS arrays for what is a per-frame hot path.
    const n=this.cols*this.rows*MAX_SPANS;
    this.floors=new Float32Array(n).fill(NaN);
    this.ceils=new Float32Array(n).fill(NaN);
    this.count=new Uint8Array(this.cols*this.rows);
    this.top=new Float32Array(this.cols*this.rows).fill(-999); // highest floor, for nav
  }

  idx(x,z){
    const ix=Math.floor((x-this.minX)/this.cell),iz=Math.floor((z-this.minZ)/this.cell);
    if(ix<0||iz<0||ix>=this.cols||iz>=this.rows)return -1;
    return iz*this.cols+ix;
  }

  /**
   * Rebuild the whole field by raycasting straight down through every cell.
   *
   * Materials are flipped to DoubleSide for the duration: with the default
   * FrontSide, a downward ray only ever registers faces whose normals point
   * back up at it, so the *underside* of geometry is invisible to the cast.
   * Without those hits there is nothing to close a solid with, every span
   * after the first is discarded, and the whole map collapses to a single
   * floor at the height of the boundary lid.
   */
  build(colliders,onProgress){
    const mats=new Set();
    for(const m of colliders){
      if(!m.material)continue;
      if(Array.isArray(m.material))for(const mm of m.material)mats.add(mm);
      else mats.add(m.material);
    }
    const restore=[];
    for(const mm of mats){restore.push([mm,mm.side]);mm.side=THREE.DoubleSide}

    try{
      this._cast(colliders,onProgress);
    }finally{
      for(const [mm,side] of restore)mm.side=side;
    }
    return this;
  }

  _cast(colliders,onProgress){
    const rc=new THREE.Raycaster();
    rc.far=(this.maxY-this.minY)+40;
    const org=new THREE.Vector3(),dn=new THREE.Vector3(0,-1,0);
    const nrm=new THREE.Vector3();
    const skyY=this.maxY+8;
    for(let iz=0;iz<this.rows;iz++){
      for(let ix=0;ix<this.cols;ix++){
        const x=this.minX+(ix+.5)*this.cell, z=this.minZ+(iz+.5)*this.cell;
        org.set(x,skyY,z);
        rc.set(org,dn);
        const hits=rc.intersectObjects(colliders,false);
        const ci=iz*this.cols+ix;
        let ceil=Infinity, n=0, top=-999;
        for(const h of hits){
          if(!h.face)continue;
          nrm.copy(h.face.normal).transformDirection(h.object.matrixWorld);
          const y=h.point.y;
          const isBoundary=!!(h.object.userData&&h.object.userData.boundary);
          if(nrm.y>UP_N){
            // Top of a solid -> a floor, capped by whatever ceiling we last
            // saw. The sealing box around the playfield is skipped: standing
            // on the sky lid is not a thing.
            if(!isBoundary && n<MAX_SPANS && ceil-y>.05){
              this.floors[ci*MAX_SPANS+n]=y;
              this.ceils[ci*MAX_SPANS+n]=ceil;
              n++;
              if(y>top)top=y;
            }
            ceil=-Infinity;   // we are now inside solid until a -Y face appears
          }else if(nrm.y<-UP_N){
            ceil=y;           // underside of a solid -> ceiling for the next floor
          }
          // near-vertical faces are walls; they bound movement horizontally and
          // are handled by the sweep rays, not by the span stack.
        }
        this.count[ci]=n;
        this.top[ci]=top;
      }
      if(onProgress&&(iz&15)===0)onProgress(iz/this.rows);
    }
  }

  /**
   * The free span whose floor is at or just below `y`.
   * @returns {{floor:number,ceil:number}|null}
   */
  spanAt(x,z,y,tol){
    const ci=this.idx(x,z);
    if(ci<0)return null;
    const n=this.count[ci];
    if(!n)return null;
    tol=tol===undefined?.6:tol;
    let best=null;
    for(let i=0;i<n;i++){
      const f=this.floors[ci*MAX_SPANS+i];
      if(f>y+tol)continue;                       // above us -- not our storey
      if(!best||f>best.floor)best={floor:f,ceil:this.ceils[ci*MAX_SPANS+i]};
    }
    return best;
  }

  /** Highest walkable surface at or below y+tol. -999 when the cell is void. */
  floorAt(x,z,y,tol){
    const s=this.spanAt(x,z,y,tol);
    return s?s.floor:-999;
  }

  /**
   * Highest floor in this cell lying within [minY, maxY].
   *
   * This is the SWEPT landing test. `spanAt` only ever looks at floors at or
   * below the body, so once a character dropped past a floor it could never
   * re-acquire it and fell forever -- which is what sent bots through the map
   * and out the bottom of the world. Passing the span the body travelled
   * through this frame catches the floor it actually crossed.
   *
   * @returns {number|null} floor height, or null if nothing was crossed
   */
  floorBetween(x,z,minY,maxY){
    const ci=this.idx(x,z);
    if(ci<0)return null;
    const n=this.count[ci];
    let best=null;
    for(let i=0;i<n;i++){
      const f=this.floors[ci*MAX_SPANS+i];
      if(f<minY||f>maxY)continue;
      if(best===null||f>best)best=f;
    }
    return best;
  }

  /** True when the cell has any walkable span at all. */
  hasFloor(x,z){
    const ci=this.idx(x,z);
    return ci>=0&&this.count[ci]>0;
  }

  /** Lowest ceiling strictly above y. Infinity when open to the sky. */
  ceilAt(x,z,y){
    const s=this.spanAt(x,z,y,.6);
    return s?s.ceil:Infinity;
  }

  /** Highest floor anywhere in the cell -- used for nav sampling and props. */
  topAt(x,z){
    const ci=this.idx(x,z);
    return ci<0?-999:this.top[ci];
  }

  /**
   * Lowest walkable floor in the cell -- i.e. street level.
   * Spawns and hand-placed props are authored as 2D coordinates and mean "on
   * the ground", so they must NOT use topAt(): that returns the roof of any
   * building standing on the same cell, which is how operators ended up
   * spawning 15 m in the air.
   */
  groundFloorAt(x,z){
    const ci=this.idx(x,z);
    if(ci<0)return -999;
    const n=this.count[ci];
    if(!n)return -999;
    let lo=Infinity;
    for(let i=0;i<n;i++){
      const f=this.floors[ci*MAX_SPANS+i];
      // Ignore crawlspaces you could not stand in anyway.
      if(this.ceils[ci*MAX_SPANS+i]-f<.9)continue;
      if(f<lo)lo=f;
    }
    return isFinite(lo)?lo:this.top[ci];
  }

  /**
   * Can a body of `height` stand at (x,z) with its feet near `feetY`?
   * This is the test that makes walls solid: inside a wall there is no span
   * with enough headroom, so every move into it is rejected.
   */
  fits(x,z,feetY,height,stepMax){
    const s=this.spanAt(x,z,feetY,stepMax);
    if(!s)return null;
    if(s.floor>feetY+stepMax)return null;          // ledge too tall to step
    if(s.ceil-s.floor<height)return null;          // crawlspace -- body won't fit
    if(s.ceil-feetY<height*.5)return null;         // head already in the ceiling
    return s;
  }

  /** Bilinear floor height, for smooth walking over ramps. */
  smoothFloor(x,z,y){
    const c=this.cell;
    const fx=(x-this.minX)/c-.5, fz=(z-this.minZ)/c-.5;
    const ix=Math.floor(fx), iz=Math.floor(fz);
    const tx=fx-ix, tz=fz-iz;
    let acc=0,wsum=0;
    for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++){
      const px=this.minX+(ix+dx+.5)*c, pz=this.minZ+(iz+dz+.5)*c;
      const s=this.spanAt(px,pz,y,.6);
      if(!s)continue;
      const w=(dx?tx:1-tx)*(dz?tz:1-tz);
      if(w<=0)continue;
      acc+=s.floor*w; wsum+=w;
    }
    if(wsum<.15)return this.floorAt(x,z,y,.6);
    return acc/wsum;
  }

  /**
   * Line-of-sight through solid geometry, sampled along the segment.
   * Blocks when the ray passes below a floor or above a ceiling at any step.
   */
  losClear(a,b){
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
    const d=Math.hypot(dx,dz);
    const steps=Math.max(2,Math.ceil(d/(this.cell*1.5)));
    for(let i=1;i<steps;i++){
      const t=i/steps;
      const x=a.x+dx*t, y=a.y+dy*t, z=a.z+dz*t;
      const ci=this.idx(x,z);
      if(ci<0)continue;
      const n=this.count[ci];
      if(!n)continue;
      let inFree=false;
      for(let k=0;k<n;k++){
        const f=this.floors[ci*MAX_SPANS+k], c2=this.ceils[ci*MAX_SPANS+k];
        if(y>=f-.12&&y<=c2+.12){inFree=true;break}
      }
      if(!inFree)return false;
    }
    return true;
  }

  /**
   * Renders a top-down image of the walkable map, once, at load time.
   *
   * The radar previously drew from ArenaBuilder.mmRects, which is only filled by
   * box() -- and the GLB map never calls box(), so the array was empty and the
   * minimap showed nothing but its own grid rings. Rasterising the span field
   * gives a real floor plan instead.
   *
   * @returns {{canvas:HTMLCanvasElement,minX:number,minZ:number,w:number,d:number}}
   */
  renderMinimap(){
    const cols=this.cols, rows=this.rows;
    const cv=document.createElement("canvas");
    cv.width=cols;cv.height=rows;
    const g=cv.getContext("2d");
    const img=g.createImageData(cols,rows);
    const px=img.data;

    // Ground height per cell, and whether a body fits there.
    const ground=new Float32Array(cols*rows).fill(NaN);
    for(let iz=0;iz<rows;iz++)for(let ix=0;ix<cols;ix++){
      const ci=iz*cols+ix;
      if(!this.count[ci])continue;
      const x=this.minX+(ix+.5)*this.cell, z=this.minZ+(iz+.5)*this.cell;
      const f=this.groundFloorAt(x,z);
      if(f<-900)continue;
      ground[ci]=f;
    }

    // A cell standing well above its surroundings is the TOP of a wall or roof,
    // not floor you could stand on. Classifying purely by "has a span" marks
    // wall tops as walkable and the whole map renders as one flat blob.
    const R=3;
    const localMin=new Float32Array(cols*rows).fill(NaN);
    for(let iz=0;iz<rows;iz++)for(let ix=0;ix<cols;ix++){
      const ci=iz*cols+ix;
      if(isNaN(ground[ci]))continue;
      let lo=Infinity;
      for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){
        const jx=ix+dx, jz=iz+dz;
        if(jx<0||jz<0||jx>=cols||jz>=rows)continue;
        const v=ground[jz*cols+jx];
        if(!isNaN(v)&&v<lo)lo=v;
      }
      localMin[ci]=isFinite(lo)?lo:ground[ci];
    }

    let lo=Infinity,hi=-Infinity;
    for(let i=0;i<cols*rows;i++){
      if(isNaN(ground[i]))continue;
      if(ground[i]<lo)lo=ground[i];
      if(ground[i]>hi)hi=ground[i];
    }
    const range=Math.max(.001,hi-lo);

    for(let i=0;i<cols*rows;i++){
      const o=i*4;
      const f=ground[i];
      if(isNaN(f)){px[o+3]=0;continue}            // nothing here -- transparent

      const x=this.minX+((i%cols)+.5)*this.cell;
      const z=this.minZ+(Math.floor(i/cols)+.5)*this.cell;
      const span=this.spanAt(x,z,f+.05,.35);
      const fits=span&&(span.ceil-span.floor)>=1.2;
      const raised=f-localMin[i];                 // height above its surroundings

      if(!fits||raised>1.0){
        // Wall, roof or something you cannot occupy -- draw it as structure.
        px[o]=44;px[o+1]=40;px[o+2]=34;px[o+3]=225;
      }else{
        // Walkable floor, shaded by elevation so ramps and levels read.
        const t=(f-lo)/range;
        px[o  ]=138+t*92;
        px[o+1]=122+t*86;
        px[o+2]=92+t*74;
        px[o+3]=isFinite(span.ceil)?205:235;      // covered ground slightly dimmer
      }
    }
    g.putImageData(img,0,0);

    return {canvas:cv,minX:this.minX,minZ:this.minZ,
            w:cols*this.cell,d:rows*this.cell};
  }

  /** Raise the floor of the span a prop sits in, so bots path over crates. */
  stamp(x,z,w,d,topY){
    const ix0=Math.floor((x-w/2-this.minX)/this.cell), ix1=Math.floor((x+w/2-this.minX)/this.cell);
    const iz0=Math.floor((z-d/2-this.minZ)/this.cell), iz1=Math.floor((z+d/2-this.minZ)/this.cell);
    for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
      if(ix<0||iz<0||ix>=this.cols||iz>=this.rows)continue;
      const ci=iz*this.cols+ix, n=this.count[ci];
      for(let k=0;k<n;k++){
        const f=this.floors[ci*MAX_SPANS+k];
        if(topY>f&&topY<this.ceils[ci*MAX_SPANS+k]){
          this.floors[ci*MAX_SPANS+k]=topY;
          if(topY>this.top[ci])this.top[ci]=topY;
        }
      }
    }
  }
}
