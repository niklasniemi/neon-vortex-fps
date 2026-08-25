// Third-person operator model, built procedurally.
// Styled as desert fatigues rather than glowing power armour -- the team colour
// survives only as a muted shoulder patch so you can still read friend from foe.
import {CFG,SETTINGS} from '../core/config.js';
import {U,_va,_vb} from '../core/util.js';
import {GFX} from '../core/globals.js';
import {matStd} from '../render/textures.js';
import {VMMAT} from '../render/viewmodels.js';

export function buildCharMesh(accent,name,showName){
const root=new THREE.Group();
const suit=matStd({color:0x4a4638,metal:.05,rough:.88});
const darkM=matStd({color:0x2e2b24,metal:.08,rough:.9});
const acc=new THREE.MeshStandardMaterial({color:accent,metalness:.1,roughness:.75});
const mk=(geo,m,x,y,z,parent)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;(parent||root).add(o);return o};
const hipY=.95;
const legL=mk(new THREE.BoxGeometry(.2,.92,.24),darkM,-.14,hipY-.46,0);
const legR=mk(new THREE.BoxGeometry(.2,.92,.24),darkM,.14,hipY-.46,0);
legL.geometry.translate(0,-.42,0);legL.position.y=hipY-.04;
legR.geometry.translate(0,-.42,0);legR.position.y=hipY-.04;
const torso=new THREE.Group();torso.position.y=hipY;root.add(torso);
mk(new THREE.BoxGeometry(.56,.62,.34),suit,0,.31,0,torso);
mk(new THREE.BoxGeometry(.6,.2,.38),acc,0,.5,0,torso);
mk(new THREE.BoxGeometry(.44,.16,.4),darkM,0,.06,0,torso);
const armL=new THREE.Group();armL.position.set(-.36,.52,0);torso.add(armL);
mk(new THREE.BoxGeometry(.15,.58,.18),darkM,0,-.26,0,armL);
const armR=new THREE.Group();armR.position.set(.36,.52,0);torso.add(armR);
mk(new THREE.BoxGeometry(.15,.52,.18),darkM,0,-.22,-.06,armR);
const gun=mk(new THREE.BoxGeometry(.09,.12,.62),VMMAT.park(),0,-.4,-.3,armR);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.028,.028,.3,8),VMMAT.steel());
barrel.rotation.x=Math.PI/2;barrel.position.set(0,.02,-.68);armR.add(barrel);
const head=new THREE.Group();head.position.y=.78;torso.add(head);
mk(new THREE.BoxGeometry(.32,.32,.32),suit,0,.14,0,head);
mk(new THREE.BoxGeometry(.26,.09,.05),acc,0,.16,.17,head);
let nameSpr=null,nameCanvas=null,nameCtx=null,nameTex=null,lastHpDrawn=-1;
if(showName){
nameCanvas=document.createElement("canvas");nameCanvas.width=256;nameCanvas.height=64;
nameCtx=nameCanvas.getContext("2d");
nameTex=new THREE.CanvasTexture(nameCanvas);
nameSpr=new THREE.Sprite(new THREE.SpriteMaterial({map:nameTex,transparent:true,depthWrite:false}));
nameSpr.scale.set(2.2,.55,1);nameSpr.position.y=2.35;
root.add(nameSpr);
}
const aura={visible:false};
GFX.scene.add(root);
root.scale.setScalar(.5);
const vis={root,legL,legR,armL,armR,torso,head,aura,
phase:U.rand(0,6),
anim(dt,speed,grounded,crouch){
this.phase+=dt*(4+speed*1.35)*(grounded?1:.4);
const k=U.clamp(speed/CFG.sprint,0,1)*(grounded?1:.3);
legL.rotation.x=Math.sin(this.phase)*.75*k;
legR.rotation.x=Math.sin(this.phase+Math.PI)*.75*k;
armL.rotation.x=Math.sin(this.phase+Math.PI)*.5*k;
torso.position.y=U.lerp(hipY,hipY-.34,crouch)+Math.abs(Math.sin(this.phase))*.03*k;
head.position.y=U.lerp(.78,.6,crouch);
},
die(dir){
const d=dir||_va.set(1,0,0);
root.userData.fallAxis=_vb.set(d.z,0,-d.x).normalize();
},
tickDeath(dt,t){
if(!root.userData.falling){root.userData.falling=0}
root.userData.falling=Math.min(1,root.userData.falling+dt*3.2);
const f=root.userData.falling;
const ax=root.userData.fallAxis||_va.set(1,0,0);
root.quaternion.setFromAxisAngle(ax,f*1.45);
root.position.y-=f*dt*1.2;
if(f>=1&&t>1.4){root.visible=false;return true}
return false;
},
reset(){
root.quaternion.identity();
root.userData.falling=false;
root.visible=true;
},
flashHit(){},
setBuff(on){},
drawName(hp){
if(!showName)return;
const v=Math.round(hp/10);
if(v===lastHpDrawn)return;lastHpDrawn=v;
nameCtx.clearRect(0,0,256,64);
nameCtx.font="700 24px Segoe UI,Arial";nameCtx.textAlign="center";
nameCtx.strokeStyle="rgba(0,0,0,.85)";nameCtx.lineWidth=5;nameCtx.strokeText(name,128,26);
nameCtx.fillStyle="#e8f6ff";nameCtx.fillText(name,128,26);
nameCtx.fillStyle="rgba(0,0,0,.55)";nameCtx.fillRect(48,38,160,9);
nameCtx.fillStyle=hp>50?"#5dff8f":hp>25?"#ffc24d":"#ff4d5e";
nameCtx.fillRect(49,39,158*U.clamp(hp/100,0,1),7);
nameTex.needsUpdate=true;
}};
vis.drawName(100);
return vis;
}
