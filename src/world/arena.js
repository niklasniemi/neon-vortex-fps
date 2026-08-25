// Geometry builder for the playable arena.
// Trimmed to what a realistic map needs -- the jump pads, teleporters, lava
// pools, energy shields and floating pickups from the arcade build are gone.
import {GRP} from '../core/config.js';
import {U} from '../core/util.js';
import {PHYS,GFX} from '../core/globals.js';
import {TexFac,matStd} from '../render/textures.js';

export class ArenaBuilder{
  constructor(){
    this.group=new THREE.Group();
    this.colliders=[];
    this.spawns={1:[],2:[]};
    this.navDefs=[];this.navLinks=[];this.mmRects=[];
    this.bounds={minX:-40,maxX:40,minZ:-40,maxZ:40};
  }

  box(x,y,z,w,h,d,o={}){
    let mesh=null;
    if(!o.noMesh){
      const geo=new THREE.BoxGeometry(w,h,d);
      let mapK=null;
      if(o.tex){
        const bt=o.texFn?o.texFn():TexFac.get(o.tex);
        const t=bt.clone();t.needsUpdate=true;
        const horiz=Math.max(w,d);
        t.repeat.set(Math.max(1,horiz/3),Math.max(1,Math.max(h,horiz)/3));
        mapK=t;
      }
      const m=matStd({color:o.color,map:mapK,rough:o.rough!==undefined?o.rough:.92,metal:o.metal!==undefined?o.metal:.04});
      mesh=new THREE.Mesh(geo,m);
      mesh.position.set(x,y,z);
      mesh.castShadow=o.cast!==false;
      mesh.receiveShadow=o.recv!==false;
      this.group.add(mesh);
    }
    if(o.col!==false){
      const body=new CANNON.Body({mass:0});
      body.addShape(new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2)));
      body.position.set(x,y,z);
      body.collisionFilterGroup=GRP.WORLD;
      body.collisionFilterMask=GRP.CHAR|GRP.PROJ;
      body.userData={type:"world",surf:o.surf||"concrete"};
      PHYS.world.addBody(body);
      if(mesh)this.colliders.push(mesh);
    }
    if(o.mm!==false&&h>=.5&&w>.5&&d>.5&&y<9&&y>-3)this.mmRects.push({x,z,w,d});
    return mesh;
  }

  stairs(x,y,z,yawDeg,steps,rise,run,width,o={}){
    const yaw=yawDeg*Math.PI/180,sy=Math.sin(yaw),cy=Math.cos(yaw);
    for(let i=0;i<steps;i++){
      const off=(i+.5)*run;
      this.box(x+sy*off,y+rise*(i+.5),z+cy*off,width,rise,run,o);
    }
  }

  nav(x,y,z,flags){this.navDefs.push({p:new THREE.Vector3(x,y,z),flags:flags||{},links:[]});return this.navDefs.length-1}
  link(i,j){this.navLinks.push([i,j])}

  spawn(x,y,z,yawDeg,team){
    const s={p:new THREE.Vector3(x,y,z),yaw:(yawDeg||0)*Math.PI/180};
    if(team)this.spawns[team].push(s);
    else{this.spawns[1].push(s);this.spawns[2].push(s)}
  }

  setBounds(minX,maxX,minZ,maxZ){this.bounds={minX,maxX,minZ,maxZ}}

  /** Physics-only playfield boundary. */
  wallInvisible(x,y,z,w,h,d){
    const body=new CANNON.Body({mass:0});
    body.addShape(new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2)));
    body.position.set(x,y,z);
    body.collisionFilterGroup=GRP.WORLD;body.collisionFilterMask=GRP.CHAR|GRP.PROJ;
    body.userData={type:"world",surf:"concrete"};
    PHYS.world.addBody(body);
    // Boundary walls must exist in the span field too, or the sweep will not
    // see them. A thin visible-less box mesh is added purely for raycasting.
    const g=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({visible:false}));
    g.userData.boundary=true;
    g.position.set(x,y,z);
    g.updateMatrixWorld(true);
    this.group.add(g);
    this.colliders.push(g);
  }
}

/** World-space ground height by raycast -- used for one-off placement. */
export function groundYAt(x,z){
  const rc=new THREE.Raycaster();
  rc.set(new THREE.Vector3(x,60,z),new THREE.Vector3(0,-1,0));
  rc.far=140;
  const hits=rc.intersectObjects(PHYS.colliders,false);
  for(const h of hits){
    if(!h.face)continue;
    const n=h.face.normal.clone().transformDirection(h.object.matrixWorld);
    if(n.y>.35)return h.point.y;
  }
  return hits.length?hits[0].point.y:0;
}
