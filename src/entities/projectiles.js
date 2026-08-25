// Thrown utility. The arcade projectile weapons (plasma bolts, sticky vortex
// mines) are gone -- grenades are the only projectiles a realistic build needs.
import {CFG,GRP,SETTINGS} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,UI,WORLD,engine} from '../core/globals.js';
import {NADE_DEFS} from '../game/weapons.js';
import {NET2} from '../net/p2p.js';
import {BaseEntity} from './combatant.js';

export class GrenadeProj extends BaseEntity{
constructor(owner,type,origin,dir,power){
super("nade");
this.owner=owner;this.type=type;this.def=NADE_DEFS[type];
const col=this.def.color;
this.mesh=new THREE.Group();
const core=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.14,10),new THREE.MeshStandardMaterial({color:0x2a2f36,metal:.6,rough:.4}));
core.rotation.z=Math.PI/2;
const band=new THREE.Mesh(new THREE.CylinderGeometry(.053,.053,.03,10),new THREE.MeshStandardMaterial({color:col,metalness:.35,roughness:.7}));
band.rotation.z=Math.PI/2;band.position.y=.02;
this.mesh.add(core,band);
this.spin=new THREE.Vector3(U.rand(-6,6),U.rand(-6,6),U.rand(-6,6));
this.mesh.position.copy(origin);
GFX.scene.add(this.mesh);
this.body=new CANNON.Body({mass:.32});
this.body.addShape(new CANNON.Sphere(.07));
this.body.position.copy(origin);
this.body.velocity.set(dir.x*power,dir.y*power+2.2,dir.z*power);
this.body.linearDamping=.12;
this.body.angularDamping=.2;
this.body.collisionFilterGroup=GRP.PROJ;
this.body.collisionFilterMask=GRP.WORLD|GRP.SHIELD;
this.body.userData={nade:this};
let bounced=false;
this._onCollide=e=>{
if(bounced)return;bounced=true;setTimeout(()=>bounced=false,120);
AUDIO.play("nadebounce",{pos:this.mesh.position,vol:.4});
if(this.type==="molotov"){this.detonate()}
};
this.body.addEventListener("collide",this._onCollide);
PHYS.addBody(this.body);
this.fuse=this.def.fuse;this.age=0;
}
detonate(){
if(this.dead)return;
this.dead=true;
const p=this.mesh.position.clone();
this.destroy();
const type=this.type;
if(type==="he"){
PHYS.explode(p,7.2,98,this.owner,6,0xd8933f,{selfMult:.5});
AUDIO.play("heboom",{pos:p});
}
else if(type==="flash"){
FX.flashPop(p);
AUDIO.play("flashpop",{pos:p,vol:.9});
for(const c of engine.combatants){
if(!c.alive||!c.body)continue;
const d=c.body.position.distanceTo(p);
if(d>26)continue;
const eye=c.eyePos(_va);
if(!PHYS.losClear(eye,_vb.copy(p),c))continue;
_vd.subVectors(p,eye).normalize();
let f=1;
if(c.isPlayer){_vc.set(0,0,-1).applyQuaternion(GFX.camera.quaternion);f=_vc.dot(_vd)*.5+.5}
else if(c.yaw!==undefined){_vc.set(-Math.sin(c.yaw),0,-Math.cos(c.yaw));f=_vc.dot(_vd)*.5+.5}
const dur=U.clamp((2.8*f+.4)*(1-d/34),0,3);
c.blindT=Math.max(c.blindT,dur);
if(c.isPlayer)UI.flashBlind(dur);
}
}
else if(type==="smoke"){
if(!WORLD.smokes)WORLD.smokes=[];
WORLD.smokes.push({p:p.clone(),r:3.4,t:15});
FX.smokeBloom(p);
AUDIO.play("smokehiss",{pos:p});
}
else if(type==="molotov"){
if(!WORLD.fires)WORLD.fires=[];
WORLD.fires.push({p:p.clone().setY(p.y+.05),r:3.1,t:7,sn:0});
FX.fireStart(p);
AUDIO.play("fireignite",{pos:p});
}
NET2.sendEv&&NET2.isHost&&NET2.sendEv({e:"nfx",t:type,x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2)});
}
update(dt){
if(this.dead)return true;
this.age+=dt;this.fuse-=dt;
this.mesh.position.copy(this.body.position);
this.mesh.rotation.x+=this.spin.x*dt;this.mesh.rotation.y+=this.spin.y*dt;
if(this.type==="molotov"){
// Ignites on a soft landing, with a hard cap so one thrown off the map
// cannot linger as an orphaned body.
if(this.age>.12&&this.body.velocity.length()<1.2){this.detonate();return true}
if(this.age>4){this.detonate();return true}
}
else if(this.fuse<=0){this.detonate();return true}
if(this.age>12){this.detonate();return true}
return false;
}
destroy(){
GFX.scene.remove(this.mesh);
if(this.body){this.body.removeEventListener("collide",this._onCollide);PHYS.removeBody(this.body)}
}
}