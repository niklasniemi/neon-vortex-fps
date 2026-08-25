// The locally controlled operator: input handling, view model, recoil.
import {CFG,GRP,SETTINGS,DIFFS,saveSettings} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf,_q1,_eu} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,INPUT,UI,WPN,MATCH,NET,WORLD,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS,NADE_ORDER,standardLoadout,defaultPistol} from '../game/weapons.js';
import {matStd} from '../render/textures.js';
import {NET2} from '../net/p2p.js';
import {Combatant} from './combatant.js';
import {buildCharMesh} from './charmesh.js';

export class Player extends Combatant{
constructor(name){
super(name);
this.isPlayer=true;this.puppet=false;
// Team is assigned by the engine after construction; the loadout is rebuilt
// then via applyTeamLoadout().
this.buildSlots(standardLoadout(1,null));
this.pitch=0;
this.recoil={p:0,y:0,vp:0,vy:0};
this.bobPhase=0;this.bobAmt=0;
this.landDip=0;this.landDipV=0;
this.adsAmt=0;this.fovCur=SETTINGS.fov;
this.prevFire=false;this.prevAds=false;
this.vmRoot=new THREE.Group();
GFX.vmScene.add(this.vmRoot);
this.vms={};
this.swayX=0;this.swayY=0;
this.deathOrbit=0;this.killerRef=null;
this.beatT=0;this.stepSurf="metal";
this.makeHitMeshes();
}
onSpawned(){
this.pitch=0;this.recoil.p=this.recoil.y=this.recoil.vp=this.recoil.vy=0;
this.chargeT=-1;this.killerRef=null;
UI.powShow(false);
for(const id in this.vms)this.vms[id].visible=false;
const vm=this.getVM(this.currentCfg().id);
if(vm)vm.visible=true;
this.switchAnim=0;this.pendingSlot=-1;
}
/** Rebuilds the slot layout for the assigned team (CT gets the USP, T the Glock). */
applyTeamLoadout(primary){
  this.buildSlots(standardLoadout(this.team||1,primary||null));
  for(const id in this.vms)this.vms[id].visible=false;
  const vm=this.getVM(this.currentCfg().id);
  if(vm)vm.visible=true;
  if(UI)UI.slotsDirty=true;
}
getVM(id){
if(!this.vms[id]){
const g=WEAPONS[id].vm();
g.traverse(o=>{o.castShadow=false;o.receiveShadow=false;if(o.material){o.material=o.material.clone();o.material.depthTest=true}});
g.visible=false;
this.vmRoot.add(g);
this.vms[id]=g;
}
return this.vms[id];
}
muzzleWorld(out){
const vm=this.vms[this.currentCfg().id];
if(vm&&vm.userData.muzzle){
this.vmRoot.updateMatrixWorld(true);
vm.userData.muzzle.getWorldPosition(out);
GFX.camera.updateMatrixWorld();
out.applyMatrix4(GFX.camera.matrixWorld);
}else out.copy(GFX.camera.position);
return out;
}
update(dt){
if(this.puppet){this.puppetUpdate(dt);return}
if(!this.alive){
this.updateDeathCam(dt);
UI.scope(false);
return;
}
this.readInput(dt);
if(MATCH.phase==="warmup"){
this.ctrl.mx=0;this.ctrl.mz=0;this.ctrl.jump=false;this.ctrl.fire=false;this.ctrl.sprint=false;
}
this.applyMove(dt);
this.syncHitRoot();
this.updateWeapon(dt);
this.updateSprings(dt);
this.updateViewModel(dt);
if(this.health<32){
this.beatT-=dt;
if(this.beatT<=0){this.beatT=.95;AUDIO.heartbeat()}
UI.critVig(true);
}else UI.critVig(false);
UI.powShow(this.buffT>0);
if(this.buffT>0)UI.powTime(Math.ceil(this.buffT));
NET.sendSample(this);
}
readInput(dt){
const k=INPUT.keys;
this.ctrl.mx=(k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0);
this.ctrl.mz=(k.KeyW||k.ArrowUp?1:0)-(k.KeyS||k.ArrowDown?1:0);
this.ctrl.sprint=!!(k.ShiftLeft||k.ShiftRight);
this.ctrl.crouch=!!(k.KeyC||k.ControlLeft);
this.ctrl.jumpConsume=true;
if(INPUT.press("Space")){this.ctrl.jump=true;}
else this.ctrl.jump=false;
const m=INPUT.consumeMouse();
const sens=.0021*SETTINGS.sens*U.lerp(1,SETTINGS.adsSens,this.adsAmt);
this.yaw-=m.dx*sens;
this.pitch-=m.dy*sens*(SETTINGS.invert?-1:1);
this.pitch=U.clamp(this.pitch,-1.55,1.55);
this.swayTarget(m);
this.ctrl.plantE=!!k.KeyE;
if(SETTINGS.autoBhop&&k.Space)this.ctrl.jump=true;
if(this.nadeCd>0)this.nadeCd-=dt;
const canBuy=MATCH.canBuy(this);
if(INPUT.press("KeyB")&&canBuy)UI.toggleBuy();
if(this.alive&&MATCH.mode.roundBased){
if(INPUT.press("KeyG")){
let found=false;
for(let k=0;k<4&&!found;k++){
this.nadeSel=(this.nadeSel+1)%NADE_ORDER.length;
const t=NADE_ORDER[this.nadeSel];
if(this.nades[t]>0){this.nadeMode=true;found=true;UI.toast("THROWING: "+NADE_DEFS[t].name+" \u2014 LMB THROW \u00B7 RMB ROLL")}
}
if(!found){this.nadeMode=false;UI.toast("NO GRENADES \u2014 BUY WITH B DURING FREEZE")}
UI.nadeBar(this);
}
if(this.nadeMode&&!(UI&&UI.buyOpen)){
const t=NADE_ORDER[this.nadeSel%NADE_ORDER.length];
if(this.nades[t]<=0){this.nadeMode=false;UI.nadeBar(this)}
else if(INPUT.btn[0]&&this.nadeCd<=0){
WPN.throwNade(this,t,WPN.aimDir(this,new THREE.Vector3()),16);
this.nadeMode=false;UI.nadeBar(this);
}else if(INPUT.btn[2]&&this.nadeCd<=0){
WPN.throwNade(this,t,WPN.aimDir(this,new THREE.Vector3()),7.5);
this.nadeMode=false;UI.nadeBar(this);
}
}
}

if(MATCH.phase!=="live")return;
for(let i=0;i<this.slots.length;i++)if(INPUT.press("Digit"+(i+1)))this.requestSwitch(i);
const w=INPUT.takeWheel();
if(w!==0&&this.slots.length>1)this.requestSwitch((this.curSlot+(w>0?1:-1)+this.slots.length)%this.slots.length);
if(INPUT.press("KeyR")){this.startReload();this._relFlag=true}
const cfg=this.currentCfg(),st=this.slotState();
const adsHeld=INPUT.btn[2]&&st.reloading<=0&&this.pendingSlot<0;
this.adsAmt=U.damp(this.adsAmt,adsHeld?1:0,13,dt);
UI.scope(cfg.scope&&this.adsAmt>.75);
const firing=INPUT.btn[0]&&!this.nadeMode&&!(UI&&UI.buyOpen);
if(firing&&!this.prevFire&&st.mag<=0&&st.reserve>0&&SETTINGS.autoReload)this.startReload();
if(st.reloading>0){this.cancelCharge();firing&&st.mag<=0&&AUDIO.play("dry",{minGap:.25});this.prevFire=firing;this.ctrl.fire=false;return}
// Semi-automatic guns need the trigger released between rounds.
const semi=cfg.auto===false;
const trigger=semi?(firing&&!this.prevFire):firing;
if(trigger&&st.cd<=0){
if(st.mag>0)this.ctrl.fire=true;
else{AUDIO.play("dry",{minGap:.22});st.cd=.25}
}
if(!firing&&this.prevFire)st.shotIdx=0;
this.prevFire=firing;
}
cancelCharge(){}
requestSwitch(i){
if(i===this.curSlot||i===this.pendingSlot)return;
if(i<0||i>4)return;
this.pendingSlot=i;
this.switchAnim=.24;
this.cancelCharge();
AUDIO.play("reload1",{vol:.5});
}
startReload(){
const st=this.slotState(),cfg=this.currentCfg();
if(st.reloading>0||st.mag>=cfg.mag||st.reserve<=0)return;
st.reloading=cfg.reload;
this.cancelCharge();
AUDIO.play("reload1");
setTimeout(()=>{if(engine.state==="playing")AUDIO.play("reload2")},Math.min(600,cfg.reload*500));
}
swayTarget(m){
this.swayX=U.damp(this.swayX,U.clamp(-m.dx*.0016,-.06,.06),8,.03);
this.swayY=U.damp(this.swayY,U.clamp(m.dy*.0016,-.05,.05),8,.03);
}
updateWeapon(dt){
const st=this.slotState(),cfg=this.currentCfg();
st.cd-=dt;
st.bloom=Math.max(0,st.bloom-cfg.bloomDecay*dt);
if(this.fireCharged){
const r=this.fireCharged;this.fireCharged=null;
if(WPN.canFire(this)){WPN.fire(this,r)}
}
if(this.ctrl.fire){
this.ctrl.fire=false;
WPN.fire(this,1);
}
if(st.reloading>0){
st.reloading-=dt;
if(st.reloading<=0){
const need=cfg.mag-st.mag,take=Math.min(need,st.reserve);
st.mag+=take;st.reserve-=take;
}
}
if(this.switchAnim>0){
this.switchAnim-=dt;
if(this.pendingSlot>=0&&this.switchAnim<=.12){
this.curSlot=this.pendingSlot;this.pendingSlot=-1;
for(const id in this.vms)this.vms[id].visible=false;
const vm=this.getVM(this.currentCfg().id);if(vm)vm.visible=true;
UI.slotsDirty=true;
}
}
const spd=this.body.velocity.length();
if(this.groundedInfo&&this.groundedInfo.grounded&&spd>3)this.bobPhase+=dt*(6+spd*.85);
this.bobAmt=U.damp(this.bobAmt,(this.groundedInfo&&this.groundedInfo.grounded&&spd>2)?1:0,8,dt);
this.landDipV+=(-this.landDip*180-this.landDipV*14)*dt;
this.landDip+=this.landDipV*dt;
}
updateSprings(dt){
const r=this.recoil;
r.p+=r.vp*dt;r.y+=r.vy*dt;
r.vp+=(-r.p*230-r.vp*17)*dt;
r.vy+=(-r.y*210-r.vy*16)*dt;
}
/**
 * Recoil. Guns with a `pattern` walk a fixed spray -- learn it and you can
 * counter it, exactly like CS. Everything else gets random kick.
 */
addRecoil(cfg,mult,shotIdx){
const rc=cfg.recoil;
const m=mult||1;
if(cfg.pattern&&cfg.pattern.length){
const p=cfg.pattern[Math.min(cfg.pattern.length-1,(shotIdx||1)-1)];
this.recoil.vp+=rc.pitch*p[1]*m*60;
this.recoil.vy+=rc.yaw*p[0]*m*60;
}else{
this.recoil.vp+=rc.pitch*m*60;
this.recoil.vy+=(Math.random()-.5)*2*rc.yaw*m*60;
}
GFX.addTrauma(rc.shake*m*SETTINGS.shake);
}
updateViewModel(dt){
const cfg=this.currentCfg(),st=this.slotState();
const vm=this.vms[cfg.id];if(!vm)return;
const t=this.adsAmt,hs=SETTINGS.vmSide;
const baseP=_va.set(U.lerp(.34*hs,0,t)+SETTINGS.vmX*.01,U.lerp(-.34,-.205,t)+SETTINGS.vmY*.01,U.lerp(-.62,-.46,t));
const bobX=Math.cos(this.bobPhase)*.014*this.bobAmt*(1-t*.8);
const bobY=Math.sin(this.bobPhase*2)*.011*this.bobAmt*(1-t*.8);
let dip=0,rotX=0;
if(st.reloading>0){
const pr=1-st.reloading/cfg.reload;
dip=-Math.sin(pr*Math.PI)*.16;
rotX=-Math.sin(pr*Math.PI)*.7;
}
if(this.switchAnim>0){
const pr=this.switchAnim/.24;
dip-=pr*.3;
}
vm.position.set(baseP.x+bobX+this.swayX,baseP.y+bobY+dip+this.swayY,baseP.z);
vm.rotation.set(rotX+this.swayY*1.4,this.swayX*2.2,0);
// Nova pump cycles after each shell.
if(vm.userData.pump){
const c=U.clamp(1-(st.cd/Math.max(.001,cfg.fireRate)),0,1);
vm.userData.pump.position.z=-.30+Math.sin(c*Math.PI)*.09;
}
}
applyKick(cfg,mult,shotIdx){this.addRecoil(cfg,mult,shotIdx)}
puppetUpdate(dt){
NET2.meTarget=null;
const s=NET2.lastSnap;
for(const sl of this.slots){
sl.cd-=dt;
sl.bloom=Math.max(0,sl.bloom-sl.cfg.bloomDecay*dt);
if(sl.cfg&&sl.reloading>0){sl.reloading-=dt;if(sl.reloading<=0){const need=sl.cfg.mag-sl.mag,take=Math.min(need,sl.reserve);sl.mag+=take;sl.reserve-=take}}
}
if(this.alive){
this.readInput(dt);
if(s&&s.me){
const m=s.me;
this.body.position.x=U.damp(this.body.position.x,m[0],22,dt);
this.body.position.y=U.damp(this.body.position.y,m[1],22,dt);
this.body.position.z=U.damp(this.body.position.z,m[2],22,dt);
this.groundedInfo={grounded:!!m[3],ny:1,surf:WORLD.def.surf};
if(m[8]!==undefined)this.money=m[8];
if(m[9]!==undefined)this.nades={he:m[9],flash:m[10],smoke:m[11],molotov:m[12]};
if(m[7])this.slots.forEach((sl,i)=>{if(m[7][i]){sl.mag=m[7][i][0];sl.reserve=m[7][i][1]}});
if(m[6]!==undefined&&m[6]!==this.curSlot&&!this.pendingSlot){this.curSlot=m[6];for(const id in this.vms)this.vms[id].visible=false;const vm=this.getVM(this.currentCfg().id);if(vm)vm.visible=true;UI.slotsDirty=true}
}
this.syncHitRoot();
this.updateSprings(dt);
this.updateViewModel(dt);
if(this.health<32){this.beatT-=dt;if(this.beatT<=0){this.beatT=.95;AUDIO.heartbeat()}UI.critVig(true)}else UI.critVig(false);
}else{this.updateDeathCam(dt);UI.scope(false)}
const cfg=this.currentCfg();
let fr=0,ch=1,nd=null;
if(this.nadeMode&&this.nadeCd<=0){
const t=NADE_ORDER[this.nadeSel%NADE_ORDER.length];
if(INPUT.btn[0]&&this.nades[t]>0){nd=t;this.nades[t]--;this.nadeCd=.8;this.nadeMode=false;UI.nadeBar(this)}
}
else if(cfg.classType==="charge"){
if(this.fireCharged){ch=this.fireCharged;this.fireCharged=null;fr=1}
}else fr=(this.alive&&this.ctrl.fire)?1:0;
if(this.alive&&INPUT.press&&this._relEdge){}
NET2.sendInput({mx:this.ctrl.mx,mz:this.ctrl.mz,sp:this.ctrl.sprint?1:0,cr:this.ctrl.crouch?1:0,
jmp:this.ctrl.jump?1:0,yaw:+this.yaw.toFixed(3),pit:+this.pitch.toFixed(3),
pe:this.ctrl.plantE?1:0,w:this.pendingSlot>=0?this.pendingSlot:this.curSlot,
rel:this._relFlag?1:0,fr:fr,ch:+ch.toFixed(2),ads:this.adsAmt>.5?1:0,nd:nd});
this._relFlag=false;
this.stats.ping=NET2.rtt;
}
remoteRespawn(e){
this.alive=true;this.health=100;this.protectT=.35;
this.body.position.set(e.x,e.y,e.z);this.body.velocity.set(0,0,0);
this.refillAmmo();this.onSpawned();
UI.respawnHide();
}
updateDeathCam(dt){
this.deathOrbit+=dt*.7;
const p=this.body.position;
const focus=this.killerRef&&this.killerRef.body?_vb.copy(this.killerRef.body.position):_vb.copy(p);
GFX.camera.position.set(p.x+Math.cos(this.deathOrbit)*3.4,p.y+2.6,p.z+Math.sin(this.deathOrbit)*3.4);
GFX.camera.lookAt(focus.x,focus.y+.8,focus.z);
}
}