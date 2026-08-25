// Hand-placed map dressing.
//
// Every prop here rests on the ground or on another prop -- the arcade build
// had a pallet that was created at ground+0.5 and then moved to ground+1.05
// with a tilt applied, leaving it hanging in mid air, plus glowing rings and
// floating letters over the bombsites. All of that is gone.
import {CFG,GRP} from '../core/config.js';
import {U} from '../core/util.js';
import {PHYS} from '../core/globals.js';
import {TexFac,matStd} from '../render/textures.js';
import {groundYAt} from './arena.js';

export function placeProps(b,def,spans){
  const R=U.mulberry(0xD0572);            // fixed seed: identical for every peer
  const ground=(x,z)=>{
    const s=spans?spans.groundFloorAt(x,z):-999;
    return s>-900?s:groundYAt(x,z);
  };

  /** Adds a mesh with a matching static box body and stamps the span field. */
  const solid=(mesh,x,y,z,ry,sx,sy,sz,surf)=>{
    mesh.position.set(x,y,z);mesh.rotation.y=ry||0;
    mesh.castShadow=true;mesh.receiveShadow=true;
    b.group.add(mesh);b.colliders.push(mesh);
    const body=new CANNON.Body({mass:0});
    body.addShape(new CANNON.Box(new CANNON.Vec3(sx/2,sy/2,sz/2)));
    body.position.set(x,y,z);
    body.quaternion.setFromEuler(0,ry||0,0);
    body.collisionFilterGroup=GRP.WORLD;body.collisionFilterMask=GRP.CHAR|GRP.PROJ;
    body.userData={type:"world",surf:surf||"wood"};
    PHYS.world.addBody(body);
    if(spans){
      // Swap footprint extents when the prop is rotated near 90 degrees.
      const rot=Math.abs(Math.sin(ry||0))>.5;
      spans.stamp(x,z,rot?sz:sx,rot?sx:sz,y+sy/2);
    }
    return mesh;
  };

  const crate=(x,z,s,ry,baseY)=>{
    const gy=baseY!==undefined?baseY:ground(x,z);
    const m=new THREE.Mesh(new THREE.BoxGeometry(s,s,s),
      matStd({map:TexFac.get("plank"),rough:.9,metal:.02}));
    return solid(m,x,gy+s/2,z,ry,s,s,s,"wood");
  };

  // A stack must sit ON the crate below it, not at an arbitrary offset.
  const crateStack=(x,z,ry)=>{
    const gy=ground(x,z);
    crate(x,z,1.05,ry,gy);
    crate(x+.04,z-.03,.78,ry+.4,gy+1.05);
    crate(x-.92,z+.42,.7,ry-.6,ground(x-.92,z+.42));
  };

  const barrel=(x,z,tipped)=>{
    const gy=ground(x,z);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.95,16),
      matStd({map:TexFac.get("barrel"),rough:.62,metal:.45}));
    if(tipped){
      m.rotation.z=Math.PI/2;
      return solid(m,x,gy+.34,z,R()*6.28,.95,.68,.68,"metal");
    }
    return solid(m,x,gy+.475,z,0,.68,.95,.68,"metal");
  };

  const sandbagLine=(x,z,ry,len)=>{
    const bagW=1.15,bagH=.42,bagD=.55;
    for(let i=0;i<len;i++){
      const ox=Math.cos(ry)*i*1.2, oz=Math.sin(ry)*i*1.2;
      const gy=ground(x+ox,z+oz);
      const m=new THREE.Mesh(new THREE.BoxGeometry(bagW,bagH,bagD),
        matStd({map:TexFac.get("sandbag"),rough:.96,metal:0}));
      solid(m,x+ox,gy+bagH/2,z+oz,ry,bagW,bagH,bagD,"dirt");
      // Second course, offset half a bag, resting on the first.
      if(i<len-1){
        const hx=x+Math.cos(ry)*(i+.5)*1.2, hz=z+Math.sin(ry)*(i+.5)*1.2;
        const m2=new THREE.Mesh(new THREE.BoxGeometry(bagW,bagH,bagD),
          matStd({map:TexFac.get("sandbag"),rough:.96,metal:0}));
        solid(m2,hx,gy+bagH*1.5,hz,ry,bagW,bagH,bagD,"dirt");
      }
    }
  };

  // Pallet lies flat on its bearers -- no tilt, no hover.
  const pallet=(x,z,ry)=>{
    const gy=ground(x,z);
    for(let i=0;i<3;i++){
      const bx=x+Math.cos(ry)*(i-1)*.6, bz=z+Math.sin(ry)*(i-1)*.6;
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.16,.12,1.1),
        matStd({map:TexFac.get("plank"),rough:.92,metal:0}));
      solid(leg,bx,gy+.06,bz,ry,.16,.12,1.1,"wood");
    }
    const top=new THREE.Mesh(new THREE.BoxGeometry(1.6,.08,1.1),
      matStd({map:TexFac.get("plank"),rough:.92,metal:0}));
    solid(top,x,gy+.16,z,ry,1.6,.08,1.1,"wood");
  };

  // Market stand: a tarp roof carried by four corner posts that reach the floor.
  const stand=(x,z,ry,w)=>{
    const gy=ground(x,z);
    const d=2.2,postH=2.3;
    const post=matStd({map:TexFac.get("wood"),rough:.9,metal:0});
    for(const sx of[-1,1])for(const sz of[-1,1]){
      const px=x+Math.cos(ry)*sx*w/2 - Math.sin(ry)*sz*d/2;
      const pz=z+Math.sin(ry)*sx*w/2 + Math.cos(ry)*sz*d/2;
      const p=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,postH,8),post);
      solid(p,px,gy+postH/2,pz,0,.13,postH,.13,"wood");
    }
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.3,.07,d+.3),
      matStd({map:TexFac.get("tarp"),rough:.95,metal:0,side:THREE.DoubleSide}));
    roof.position.set(x,gy+postH,z);roof.rotation.y=ry;
    roof.castShadow=true;
    b.group.add(roof);b.colliders.push(roof);
    const rb=new CANNON.Body({mass:0});
    rb.addShape(new CANNON.Box(new CANNON.Vec3((w+.3)/2,.05,(d+.3)/2)));
    rb.position.set(x,gy+postH,z);rb.quaternion.setFromEuler(0,ry,0);
    rb.collisionFilterGroup=GRP.WORLD;rb.collisionFilterMask=GRP.CHAR|GRP.PROJ;
    rb.userData={type:"world",surf:"cloth"};
    PHYS.world.addBody(rb);
  };

  const sites=def.sites||[];
  const A=sites[0], B=sites[1];

  if(A){
    crateStack(A.x+2.2,A.z-1.6,R()*6.28);
    crateStack(A.x-2.4,A.z+1.2,R()*6.28);
    crate(A.x-.5,A.z-2.6,1.05,R()*6.28);
    barrel(A.x+3.4,A.z+1.1);
    sandbagLine(A.x-3.6,A.z-1.4,1.35,4);
    pallet(A.x+1.1,A.z+3.0,.7);
  }
  if(B){
    crateStack(B.x+2.0,B.z-1.4,R()*6.28);
    crate(B.x-2.2,B.z+.8,1.05,R()*6.28);
    barrel(B.x+3.2,B.z-1.0);
    barrel(B.x-3.4,B.z+1.4,true);
    sandbagLine(B.x+.5,B.z+2.6,0,4);
    pallet(B.x-1.2,B.z-2.4,.4);
  }

  // Mid and connector cover.
  crateStack(2.2,-1.2,R()*6.28);
  crate(-1.8,.9,1.05,R()*6.28);
  sandbagLine(-.4,-3.2,.2,3);
  stand(-6.5,-2.2,.35,4.4);
  stand(9.5,4.4,-1.2,4.4);

  return {crate,barrel,pallet,stand};
}

/**
 * Bombsite markers painted flat on the floor.
 * The old build drew an additive glowing ring plus a letter sprite hovering
 * 3.4 m in the air; both are replaced by a ground decal that sits 2 cm above
 * the floor and reads as spray paint.
 */
export function addSiteMarkers(def,group,spans){
  if(!def.sites)return;
  for(const s of def.sites){
    const y=(spans&&spans.groundFloorAt(s.x,s.z)>-900)?spans.groundFloorAt(s.x,s.z):groundYAt(s.x,s.z);

    const c=document.createElement("canvas");c.width=c.height=256;
    const g=c.getContext("2d");
    g.clearRect(0,0,256,256);
    g.strokeStyle="rgba(226,196,120,.85)";g.lineWidth=10;
    g.beginPath();g.arc(128,128,104,0,7);g.stroke();
    g.setLineDash([16,14]);g.lineWidth=5;
    g.beginPath();g.arc(128,128,84,0,7);g.stroke();
    g.setLineDash([]);
    g.font="900 150px Impact,Haettenschweiler,Arial Black,sans-serif";
    g.textAlign="center";g.textBaseline="middle";
    g.fillStyle="rgba(226,196,120,.9)";
    g.fillText(s.name,128,138);
    // scuff the paint so it looks sprayed, not printed
    g.globalCompositeOperation="destination-out";
    for(let i=0;i<160;i++){
      g.beginPath();g.arc(U.rand(0,256),U.rand(0,256),U.rand(2,9),0,7);
      g.fillStyle="rgba(0,0,0,"+U.rand(.15,.5)+")";g.fill();
    }

    const tex=new THREE.CanvasTexture(c);
    const decal=new THREE.Mesh(
      new THREE.PlaneGeometry(s.r*2,s.r*2),
      new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.75,depthWrite:false})
    );
    decal.rotation.x=-Math.PI/2;
    decal.position.set(s.x,y+.02,s.z);
    decal.renderOrder=2;
    group.add(decal);
  }
}
