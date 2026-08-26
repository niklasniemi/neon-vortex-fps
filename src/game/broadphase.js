// Raycast broadphase.
//
// Every ray used to be tested against all 419 collider meshes -- roughly
// 19,000 bounding-sphere tests per frame once bots and the movement sweeps are
// running. This indexes the meshes into a uniform XZ grid so a ray only tests
// the ones whose cells it actually crosses, and reuses its output buffers so
// the hot path allocates nothing (per-frame garbage is what turns a steady
// frame time into periodic spikes).
const CELL=5;                 // metres per grid cell

export class Broadphase{
  constructor(){
    this.cells=new Map();     // "ix,iz" -> mesh[]
    this.meshes=[];
    this.tall=[];             // meshes too large to index usefully
    this._out=[];
    this._seen=new Set();
  }

  key(ix,iz){return ix+","+iz}

  /** Indexes every collider by the grid cells its bounding box covers. */
  build(colliders){
    this.cells.clear();
    this.meshes=colliders.slice();
    this.tall.length=0;
    const box=new THREE.Box3();
    for(const m of colliders){
      m.updateMatrixWorld(true);
      box.setFromObject(m);
      if(!isFinite(box.min.x)||!isFinite(box.max.x))continue;
      const w=box.max.x-box.min.x, d=box.max.z-box.min.z;
      // A mesh spanning most of the map (the ground plane, the boundary shell)
      // would land in every cell; keep those in a small always-test list.
      if(w>60||d>60){this.tall.push(m);continue}
      const ix0=Math.floor(box.min.x/CELL), ix1=Math.floor(box.max.x/CELL);
      const iz0=Math.floor(box.min.z/CELL), iz1=Math.floor(box.max.z/CELL);
      for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
        const k=this.key(ix,iz);
        let arr=this.cells.get(k);
        if(!arr){arr=[];this.cells.set(k,arr)}
        arr.push(m);
      }
    }
    return this;
  }

  /**
   * Meshes a ray could possibly hit.
   * Walks the grid cells along the segment (a 2D DDA) and unions their
   * contents. The returned array is REUSED -- copy it if you need to keep it.
   * @returns {THREE.Object3D[]}
   */
  query(origin,dir,length){
    const out=this._out, seen=this._seen;
    out.length=0; seen.clear();
    for(const m of this.tall){out.push(m);seen.add(m)}

    const x0=origin.x, z0=origin.z;
    const x1=x0+dir.x*length, z1=z0+dir.z*length;

    let ix=Math.floor(x0/CELL), iz=Math.floor(z0/CELL);
    const ixEnd=Math.floor(x1/CELL), izEnd=Math.floor(z1/CELL);

    const dx=x1-x0, dz=z1-z0;
    const stepX=dx>0?1:-1, stepZ=dz>0?1:-1;
    // Guard against a purely vertical ray, where dx and dz are both ~0.
    const tDeltaX=Math.abs(dx)<1e-9?Infinity:Math.abs(CELL/dx);
    const tDeltaZ=Math.abs(dz)<1e-9?Infinity:Math.abs(CELL/dz);
    let tMaxX=Math.abs(dx)<1e-9?Infinity:
      ((dx>0?(ix+1)*CELL-x0:x0-ix*CELL)/Math.abs(dx));
    let tMaxZ=Math.abs(dz)<1e-9?Infinity:
      ((dz>0?(iz+1)*CELL-z0:z0-iz*CELL)/Math.abs(dz));

    // Cells are gathered with a one-cell skirt so a ray grazing a boundary
    // still sees the geometry on the other side of it.
    const add=(cx,cz)=>{
      for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){
        const arr=this.cells.get(this.key(cx+ox,cz+oz));
        if(!arr)continue;
        for(const m of arr){if(!seen.has(m)){seen.add(m);out.push(m)}}
      }
    };

    add(ix,iz);
    let guard=0;
    while((ix!==ixEnd||iz!==izEnd)&&guard++<256){
      if(tMaxX<tMaxZ){tMaxX+=tDeltaX;ix+=stepX}
      else{tMaxZ+=tDeltaZ;iz+=stepZ}
      add(ix,iz);
      if(tMaxX>1&&tMaxZ>1)break;
    }
    return out;
  }
}
