// Loads pvp_map.glb and dresses it to read as Dust II.
//
// The GLB ships untextured, so surfaces are classified by geometry rather than
// by material name: how the face is oriented, how big it is, and how high it
// sits. Floors get sand or cobble, walls get sandstone brick low down and
// plaster higher up, small parts get wood or metal. That is what turns a grey
// blockout into something that reads as the real map.
import {GRP} from '../core/config.js';
import {U} from '../core/util.js';
import {PHYS,UI} from '../core/globals.js';
import {TexFac,matStd} from '../render/textures.js';

const _v=new THREE.Vector3();
const _n=new THREE.Vector3();

/** Fraction of a mesh's triangles that face upward -- floors approach 1. */
function upwardRatio(geo){
  const pos=geo.attributes.position,idx=geo.index;
  const n=idx?idx.count:pos.count;
  const step=Math.max(3,Math.floor(n/300)*3);   // sample, do not scan everything
  let up=0,tot=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const ab=new THREE.Vector3(),ac=new THREE.Vector3();
  for(let i=0;i+2<n;i+=step){
    const i0=idx?idx.getX(i):i, i1=idx?idx.getX(i+1):i+1, i2=idx?idx.getX(i+2):i+2;
    a.fromBufferAttribute(pos,i0);b.fromBufferAttribute(pos,i1);c.fromBufferAttribute(pos,i2);
    ab.subVectors(b,a);ac.subVectors(c,a);
    _n.crossVectors(ab,ac).normalize();
    if(Math.abs(_n.y)>.7)up++;
    tot++;
  }
  return tot?up/tot:0;
}

function classify(name,size,upRatio,minY,baseY){
  const [sx,sy,sz]=size;
  const horiz=Math.max(sx,sz);
  const area=sx*sz;
  const heightAboveGround=minY-baseY;

  if(/floor|ground|plane|terrain/.test(name))return "sand";
  if(/crate|box|pallet|plank|door|wood/.test(name))return "plank";
  if(/barrel|drum|pipe|cylinder/.test(name))return "barrel";
  if(/metal|roof|sheet|container/.test(name))return "metal";

  // Broad, flat and low: it is walkable ground.
  if(upRatio>.6&&sy<1.2&&area>6){
    return heightAboveGround>1.2?"concrete":(area>140?"sand":"cobble");
  }
  // Tall and thin: a wall. Brick at ground level, plaster on upper storeys.
  if(sy>1.4&&horiz>1.2)return heightAboveGround>2.6?"plaster":"sandbrick";
  // Small chunks: crates, kerbs, trims.
  if(horiz<1.6&&sy<1.6)return "plank";
  return "plaster";
}

export function buildGLBArena(def,b){
  return new Promise((resolve,reject)=>{
    if(!THREE.GLTFLoader)return reject(new Error("GLTFLoader unavailable"));
    new THREE.GLTFLoader().load(def.glb,gltf=>{
      try{
        const root=gltf.scene||gltf.scenes[0];
        root.updateMatrixWorld(true);
        const meshes=[];
        root.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.attributes.position)meshes.push(o)});
        if(!meshes.length)throw new Error("GLB contains no meshes");

        const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
        const baked=[];
        for(const m of meshes){
          const geo=m.geometry,pos=geo.attributes.position,idx=geo.index,n=pos.count;
          const arr=new Float32Array(n*3);
          for(let i=0;i<n;i++){
            _v.fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld);
            arr[i*3]=_v.x;arr[i*3+1]=_v.y;arr[i*3+2]=_v.z;
            for(let k=0;k<3;k++){
              const val=k===0?_v.x:k===1?_v.y:_v.z;
              if(val<mn[k])mn[k]=val;
              if(val>mx[k])mx[k]=val;
            }
          }
          baked.push({m,arr,idx,n});
        }
        const baseY=mn[1];

        for(const {m,arr,idx,n} of baked){
          const bbMin=[1e9,1e9,1e9],bbMax=[-1e9,-1e9,-1e9];
          for(let i=0;i<n;i++)for(let k=0;k<3;k++){
            const v=arr[i*3+k];
            if(v<bbMin[k])bbMin[k]=v;
            if(v>bbMax[k])bbMax[k]=v;
          }
          const size=[Math.max(.05,bbMax[0]-bbMin[0]),Math.max(.05,bbMax[1]-bbMin[1]),Math.max(.05,bbMax[2]-bbMin[2])];
          const name=(m.name||"").toLowerCase();
          const key=classify(name,size,upwardRatio(m.geometry),bbMin[1],baseY);

          const tex=TexFac.get(key).clone();
          tex.needsUpdate=true;
          // Tile size per surface class. Brick was repeating every 2.5 m, which
          // read as bathroom tile rather than masonry.
          const TILE={sand:5.0,cobble:3.4,sandbrick:4.2,plaster:5.0,concrete:4.6,
                      plank:1.8,barrel:1.4,metal:2.6,rust:2.6}[key]||4.0;
          const isFloor=(key==="sand"||key==="cobble");
          if(isFloor)tex.repeat.set(Math.max(1,size[0]/TILE),Math.max(1,size[2]/TILE));
          else tex.repeat.set(Math.max(1,Math.max(size[0],size[2])/TILE),Math.max(1,size[1]/TILE));

          const rough=key==="metal"?.55:key==="barrel"?.6:.94;
          const metal=key==="metal"?.55:key==="barrel"?.45:.03;
          m.material=matStd({map:tex,color:0xffffff,rough,metal});
          m.castShadow=true;m.receiveShadow=true;
          m.userData.solid=true;
          b.colliders.push(m);

          let indices;
          if(idx)indices=new Uint32Array(idx.array);
          else{indices=new Uint32Array(n);for(let i=0;i<n;i++)indices[i]=i}
          const body=new CANNON.Body({mass:0});
          body.addShape(new CANNON.Trimesh(arr,indices));
          body.collisionFilterGroup=GRP.WORLD;
          body.collisionFilterMask=GRP.CHAR|GRP.PROJ;
          body.userData={type:"world",surf:key==="metal"?"metal":"concrete"};
          PHYS.world.addBody(body);
        }

        b.group.add(root);

        // Sealed playfield: four tall boxes plus a lid, so nothing escapes the
        // map even if the geometry has a hole in it.
        const W=mx[0]-mn[0],D=mx[2]-mn[2],cx=(mn[0]+mx[0])/2,cz=(mn[2]+mx[2])/2;
        const topY=mx[1]+6;
        b.wallInvisible(cx,topY/2,mn[2]-1.5,W+8,topY+20,2);
        b.wallInvisible(cx,topY/2,mx[2]+1.5,W+8,topY+20,2);
        b.wallInvisible(mn[0]-1.5,topY/2,cz,2,topY+20,D+8);
        b.wallInvisible(mx[0]+1.5,topY/2,cz,2,topY+20,D+8);
        b.wallInvisible(cx,topY+1,cz,W+8,2,D+8);   // ceiling lid

        b.setBounds(mn[0]-1,mx[0]+1,mn[2]-1,mx[2]+1);
        def.aabb={min:mn,max:[mx[0],topY+2,mx[2]]};
        resolve();
      }catch(e){reject(e)}
    },
    ev=>{if(ev&&ev.total&&UI)UI.loadtxt("STREAMING MAP · "+Math.round(ev.loaded/ev.total*100)+"%")},
    err=>reject(err&&err.message?err:new Error("map download failed")));
  });
}
