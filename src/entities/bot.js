// AI operator. A utility FSM over the nav graph, with per-round objectives
// handed down by the match controller.
import {CFG,GRP,SETTINGS,DIFFS,BOT_NAMES,TEAM_HEX} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,UI,WPN,MATCH,BOTMAN,WORLD,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS,NADE_ORDER,defaultPistol,standardLoadout,botPickPrimary} from '../game/weapons.js';
import {Combatant} from './combatant.js';
import {buildCharMesh} from './charmesh.js';

export class Bot extends Combatant{
constructor(name,diffKey,team,accent){
super(name);
this.isBot=true;
this.buildSlots(standardLoadout(team,null));
this.diff=DIFFS[diffKey];
this.team=team;this.accent=accent!==undefined?accent:(team?TEAM_HEX[team]:FFA_HUES[U.randi(0,7)]);
this.visual=buildCharMesh(this.accent,this.name,true);
this.makeHitMeshes();
this.state="PATROL";this.stateT=0;this.thinkT=0;this.percT=0;
this.pitch=0;this.visPitch=0;
this.target=null;this.reactAt=0;this.memory=0;
this.path=null;this.pathI=0;this.repathT=0;
this.strafeDir=U.pick([-1,1]);this.strafeT=0;this.crouchF=0;
this.campUntil=0;this.stuckT=0;this.lastPos=new THREE.Vector3();
this.jumpPulse=false;this.aimYaw=this.yaw;this.aimPitch=0;
this.wpnChoiceT=0;this.burstLeft=0;this.burstPauseT=0;
}
onSpawned(){
this.visual.reset();
this.state="PATROL";this.path=null;this.target=null;this.chargeT=-1;
this.visual.drawName(100);
}
onDeath(src,info){
this.killerRef=src;
if(src&&src.body){
_vd.set(this.body.position.x-src.body.position.x,0,this.body.position.z-src.body.position.z).normalize();
}else _vd.set(U.rand(-1,1),0,U.rand(-1,1)).normalize();
this.visual.die(_vd.clone());
FX.preset("spark",_ve.copy(this.body.position).setY(this.body.position.y+1),{count:20,color:[[1,.5,.2]],speedMult:1.4});
}
update(dt){
if(!this.alive){
if(this.body)this.syncVisual(dt,true);
return;
}
if(this.blindT>0){
this.blindT-=dt;
this.ctrl.mx=U.rand(-.6,.6);this.ctrl.mz=U.rand(-.4,.4);this.ctrl.jump=false;this.ctrl.fire=false;
this.applyMove(dt);this.ctrl.jump=false;
this.syncVisual(dt,false);
return;
}
this.thinkT-=dt;this.percT-=dt;this.stateT+=dt;this.strafeT-=dt;this.repathT-=dt;this.wpnChoiceT-=dt;
if(this.percT<=0){this.percT=.11;this.perceive()}
if(MATCH.phase==="warmup"){
this.ctrl.mx=0;this.ctrl.mz=0;this.ctrl.jump=false;this.ctrl.sprint=false;this.ctrl.plantE=false;
}else if(MATCH.mode.roundBased){
if(this.thinkT<=0)this.thinkT=.2+Math.random()*.1;
this.defusalBrain(dt);
}else{
if(this.thinkT<=0){this.thinkT=.17+Math.random()*.08;this.decide()}
switch(this.state){
case"PATROL":this.actPatrol(dt);break;
case"ENGAGE":this.actEngage(dt);break;
case"SEEK":this.actSeek(dt);break;
case"RETREAT":this.actRetreat(dt);break;
case"HIGHGROUND":this.actHigh(dt);break;
}
}
this.applyMove(dt);
this.ctrl.jump=false;
this.manageWeapon(dt);
this.syncVisual(dt,false);
}
perceive(){
let best=null,bd=1e9;
const eye=this.eyePos(_va);
for(const c of engine.combatants){
if(c===this||!c.alive)continue;
if(MATCH.mode.teams&&c.team===this.team)continue;
const cp=c.chestPos(_vb);
const d=eye.distanceTo(cp);
if(d>75)continue;
if(!PHYS.losClear(eye,cp,this)){continue}
if(d<bd){bd=d;best=c}
}
if(best){
const reacq=this.target!==best||engine.time>this.memory+2.5;
if(reacq)this.reactAt=engine.time+this.diff.react*(0.8+Math.random()*.7);
this.target=best;this.memory=engine.time+1.6;
}else if(engine.time>this.memory)this.target=null;
}
decide(){
const hp=this.health;
const lowHp=hp<38;
const lowAmmo=(()=>{let tot=0;for(const s of this.slots)tot+=s.mag+s.reserve*.3;return tot<26})();
const engaged=!!this.target&&engine.time<this.memory+0.4&&this.targetDist()<60;
if(lowHp&&!engaged&&BOTMAN.nodeOf("hp")){this.setState("SEEK","hp");return}
if(lowAmmo&&!engaged&&BOTMAN.nodeOf("am")){this.setState("SEEK","am");return}
if(engaged){this.setState("ENGAGE");return}
if(lowHp&&engine.time-this.hurtT<4){this.setState("RETREAT");return}
if(this.state==="ENGAGE")this.setState("PATROL");
if((this.state==="PATROL"||this.state==="SEEK")&&this.stateT>U.rand(7,13)&&BOTMAN.nodeOf("high")&&Math.random()<.5){
this.setState("HIGHGROUND");return;
}
if(this.state!=="PATROL")this.setState("PATROL");
}
setState(s,arg){
if(this.state===s&&arg===undefined)return;
this.state=s;this.stateT=0;this.path=null;this.pathI=0;
this.seekFlag=arg||null;
if(s==="RETREAT"){
const threat=this.target?this.target.body.position:null;
const n=BOTMAN.coverAway(this.body.position,threat);
if(n)this.goTo(n);
}
if(s==="SEEK"){const n=BOTMAN.nearestFlagged(this.body.position,arg);if(n)this.goTo(n)}
if(s==="HIGHGROUND"){const n=BOTMAN.nearestFlagged(this.body.position,"high");if(n)this.goTo(n);this.campUntil=engine.time+U.rand(6,11)}
if(s==="PATROL"){const n=BOTMAN.randomNode(MATCH.mode.id!=="defuse");if(n)this.goTo(n)}
}
targetDist(){return this.target&&this.target.alive?this.eyePos(_va).distanceTo(this.target.chestPos(_vb)):1e9}
goToRaw(pos){this.path=BOTMAN.findPath(this.body.position,pos);this.pathI=0;this.repathT=2.8}
defusalBrain(dt){
this.ctrl.plantE=false;this.ctrl.mx=0;this.ctrl.mz=0;this.ctrl.sprint=false;
const md=MATCH.mode;
const inDefuse=md.bombState==="planted"&&this.team===1&&md.bombPos&&this.body.position.distanceTo(md.bombPos)<1.8;
const inPlant=this.hasBomb&&md.bombState==="carried"&&this.objRole==="plant"&&md.siteAt(this.body.position);
if(inDefuse){
this.ctrl.plantE=true;
_vd.subVectors(md.bombPos,this.body.position);
this.faceYaw(Math.atan2(-_vd.x,-_vd.z),dt,4);
return;
}
if(inPlant){this.ctrl.plantE=true;return}
if(this.target&&this.target.alive&&engine.time<this.memory){
const eye=this.eyePos(_va),tp=this.target.chestPos(_vb);
if(PHYS.losClear(eye,tp,this)){
if(this.reactAt<=engine.time)this.actEngage(dt);
else this.faceYaw(Math.atan2(-(tp.x-eye.x),-(tp.z-eye.z)),dt,this.diff.turn*.6);
return;
}
}
if(this.objRole==="retrieve"&&MATCH.mode.bombState==="dropped")this.objPoint=MATCH.mode.bombPos?MATCH.mode.bombPos.clone():this.objPoint;
const goal=this.objPoint;
if(!goal){this.yaw+=dt*.5;return}
_vd.subVectors(goal,this.body.position);_vd.y=0;
const d=_vd.length();
if(d>5){
if(!this.path||this.pathI>=this.path.length||this.repathT<=0)this.goToRaw(goal);
this.followPath(dt);
}else{
this.faceYaw(Math.atan2(-_vd.x,-_vd.z),dt,this.diff.turn*.9);
this.ctrl.sprint=false;
if(d>1.1){this.ctrl.mz=1;this.ctrl.mx=0}
else{
this.ctrl.mz=0;this.ctrl.mx=0;
if(this.objRole==="plant"&&md.bombState==="carried"&&this.hasBomb){
const s=md.siteAt(this.body.position);
if(s)this.ctrl.plantE=true;
}
if(this.objRole==="defuse"&&md.bombState==="planted"&&this.team===1&&md.bombPos){
if(this.body.position.distanceTo(md.bombPos)<1.7)this.ctrl.plantE=true;
}
}
}
this.checkStuck(dt);
}
goTo(node){
this.path=BOTMAN.findPath(this.body.position,node.p);
this.pathI=0;this.repathT=3.5;
}
followPath(dt){
if(!this.path||this.pathI>=this.path.length)return null;
const wp=this.path[this.pathI];
_vd.subVectors(wp,this.body.position);_vd.y=0;
const hd=_vd.length();
if(hd<1.1){
this.pathI++;
return this.followPath(dt);
}
const nxt=this.path[Math.min(this.pathI+1,this.path.length-1)];
if(nxt.y>this.body.position.y+.5&&hd<2.4&&this.groundedInfo.grounded)this.jumpPulse=true;
this.faceYaw(Math.atan2(-_vd.x,-_vd.z),dt,this.diff.turn*.8);
this.ctrl.mz=1;this.ctrl.mx=0;
return wp;
}
faceYaw(targetYaw,dt,rate){
this.yaw=U.angLerp(this.yaw,targetYaw,U.clamp(rate*dt,0,1));
}
actPatrol(dt){
this.ctrl.sprint=false;this.ctrl.crouch=false;
const wp=this.followPath(dt);
if(!wp&&(!this.path||this.pathI>=this.path.length)){
if(this.repathT<=0){this.repathT=1;const n=BOTMAN.randomNode(MATCH.mode.id!=="defuse");if(n)this.goTo(n)}
}
this.checkStuck(dt);
}
actSeek(dt){
this.ctrl.sprint=false;
const wp=this.followPath(dt);
if(!wp){
const n=BOTMAN.nearestFlagged(this.body.position,this.seekFlag);
if(n&&n.p.distanceTo(this.body.position)<4)this.setState("PATROL");
else if(this.repathT<=0){this.repathT=2;const nn=BOTMAN.nearestFlagged(this.body.position,this.seekFlag);if(nn)this.goTo(nn);else this.setState("PATROL")}
}
this.checkStuck(dt);
}
actRetreat(dt){
this.ctrl.sprint=false;
const done=!this.followPath(dt)||this.stateT>6;
if(done&&(this.health>65||this.stateT>8))this.setState("PATROL");
this.checkStuck(dt);
}
actHigh(dt){
if(this.stateT<this.campUntil-engine.time-2||(!this.path||this.pathI<this.path.length)){
this.ctrl.sprint=false;this.followPath(dt);this.checkStuck(dt);return;
}
this.ctrl.mz=0;this.ctrl.sprint=false;
this.yaw+=dt*.5*Math.sin(engine.time*.4);
if(this.stateT>this.campUntil)this.setState("PATROL");
}
actEngage(dt){
const t=this.target;
if(!t||!t.alive){this.setState("PATROL");return}
const eye=this.eyePos(_va);
const tp=t.chestPos(_vb);
const dist=eye.distanceTo(tp);
const cfg=this.currentCfg();
const rng=cfg.aiRange;
if(dist>rng[1]+4){
this.ctrl.sprint=false;
this.faceYaw(Math.atan2(-(tp.x-eye.x),-(tp.z-eye.z)),dt,this.diff.turn);
this.ctrl.mz=1;this.ctrl.mx=0;
}else{
if(this.strafeT<=0){this.strafeT=U.rand(.55,1.2);this.strafeDir*=-1;if(Math.random()<.25)this.crouchF=U.rand(.4,1);else this.crouchF=0}
this.ctrl.crouch=this.crouchF>.6&&Math.sin(engine.time*2)>-.4;
this.ctrl.sprint=false;
this.faceTarget(dt,tp,dist);
this.ctrl.mx=this.strafeDir;
const want=dist<rng[0]?-1:dist>rng[1]?0:this.strafeDir;
this.ctrl.mx=want===0?this.strafeDir:want*this.strafeDir;
this.ctrl.mz=want===-1?-0.7:0;
if(want===-1){_vd.subVectors(tp,eye);_vd.y=0;_vd.normalize();this.ctrl.mz=-.8;this.ctrl.mx=this.strafeDir*.4;
this.faceYaw(Math.atan2(-_vd.x,-_vd.z),dt,this.diff.turn)}
}
if(this.reactAt>engine.time)return;
if(!PHYS.losClear(eye,tp,this)&&cfg.classType!=="projectile"){this.memory=engine.time;return}
if(this.nades.he>0&&dist>7&&dist<24&&Math.random()<.012){
this.nades.he--;
_vd.subVectors(this.leadPoint(tp,t,dist,cfg),eye).normalize();
WPN.throwNade(this,"he",_vd.clone(),U.clamp(dist*.85,8,17));
}
const aimErr=this.diff.err*(0.55+dist*this.diff.distErr);
const lead=this.leadPoint(tp,t,dist,cfg);
_vd.subVectors(lead,eye).normalize();
const tyaw=Math.atan2(-_vd.x,-_vd.z);
const tpitch=Math.asin(U.clamp(_vd.y,-1,1))+U.gauss()*aimErr;
this.faceAim(tyaw,tpitch,dt,dist);
const aligned=Math.abs(((tyaw-this.yaw+Math.PI)%6.283185)-Math.PI)<.09+aimErr;
const st=this.slotState();
if(this.burstPauseT>0)this.burstPauseT-=dt;
if(aligned&&this.burstPauseT<=0&&st.cd<=0&&st.reloading<=0&&st.mag>0&&this.switchAnim<=0){
WPN.botFire(this,1);
if(cfg.classType==="hitscan"){
if(this.burstLeft<=0)this.burstLeft=U.randi(this.diff.burst[0],this.diff.burst[1]);
this.burstLeft--;
if(this.burstLeft<=0)this.burstPauseT=U.rand(this.diff.burstPause[0],this.diff.burstPause[1]);
}
}
}
leadPoint(tp,target,dist,cfg){
if(cfg.classType==="projectile"||cfg.classType==="sticky"){
if(cfg.proj&&target.body){
const sp=cfg.proj.speed;
const tt=dist/sp;
return _ve.copy(tp).addScaledVector(_vf.set(target.body.velocity.x,target.body.velocity.y,target.body.velocity.z),tt*this.diff.dmg);
}
}
return _ve.copy(tp);
}
faceTarget(dt,tp,dist){this.faceAim(Math.atan2(-(tp.x-this.body.position.x),-(tp.z-this.body.position.z)),0,dt,dist)}
faceAim(tyaw,tpitch,dt,dist){
const rate=this.diff.turn*(1.1-Math.min(.5,dist*.008));
this.yaw=U.angLerp(this.yaw,tyaw,U.clamp(rate*dt,0,1));
this.visPitch=U.lerp(this.visPitch||0,tpitch,U.clamp(rate*1.4*dt,0,1));
// The line that used to sit here multiplied its own delta by 0 and, because
// `pitch` started undefined, poisoned it to NaN on the first call. `aimDir`
// falls back to 0 for a non-finite pitch, so bots could only ever fire
// perfectly level -- they could not shoot at anyone above or below them.
if(!isFinite(this.pitch))this.pitch=0;
this.pitch=U.clamp(U.lerp(this.pitch,tpitch,U.clamp(rate*1.2*dt,0,1)),-1.5,1.5);
}
manageWeapon(dt){
const st=this.slotState(),cfg=this.currentCfg();
st.cd-=dt;
st.bloom=Math.max(0,st.bloom-cfg.bloomDecay*dt);
if(st.reloading>0){
st.reloading-=dt;
if(st.reloading<=0){const need=cfg.mag-st.mag,take=Math.min(need,st.reserve);st.mag+=take;st.reserve-=take}
}
if(st.mag<=0&&st.reloading<=0){
if(st.reserve>0)st.reloading=cfg.reload;
else{for(const s of this.slots){if(!s.cfg)continue;s.mag=s.cfg.mag;s.reserve=s.cfg.reserve}}
}
if(this.wpnChoiceT<=0&&this.target&&this.target.alive){
this.wpnChoiceT=2.5;
const d=this.targetDist();
let bestId=null,bestScore=-1;
for(let i=0;i<this.slots.length;i++){
const s=this.slots[i];
if(s.mag+s.reserve<=0)continue;
const r=WEAPONS[s.id].aiRange;
let sc=1-Math.abs((d-(r[0]+r[1])/2)/((r[1]-r[0])/2+1));
sc+=U.rand(0,.4);
if(sc>bestScore){bestScore=sc;bestId=i}
}
if(bestId!==null&&bestId!==this.curSlot&&st.reloading<=0){
this.curSlot=bestId;
for(const s of this.slots)s.cd=Math.max(s.cd,.35);
}
}
}
checkStuck(dt){
const b=this.body;
const moved=b.position.distanceTo(this.lastPos);
if(this.ctrl.mz!==0||this.ctrl.mx!==0){
if(moved<dt*.6)this.stuckT+=dt;else this.stuckT=Math.max(0,this.stuckT-dt*2);
if(this.stuckT>.45){this.jumpPulse=true;this.ctrl.mx=U.rand(-1,1)}
if(this.stuckT>1.2){this.stuckT=0;this.repathT=0;this.path=null;if(MATCH.mode.roundBased&&this.objPoint){this.goToRaw(this.objPoint)}else this.setState(this.state,this.seekFlag)}
}
this.lastPos.copy(b.position);
if(this.jumpPulse){
if(this.groundedInfo&&this.groundedInfo.grounded){this.doJump(this.groundedInfo)}
this.jumpPulse=false;
}
}
syncVisual(dt,dead){
const b=this.body,p=b.position;
this.visYaw=U.angLerp(this.visYaw,this.yaw,U.clamp(dt*10,0,1));
if(dead){
this.hitRoot.position.set(p.x,-999,p.z);
this.visual.tickDeath(dt,engine.time-this.deathT);
return;
}
const spd=Math.sqrt(b.velocity.x*b.velocity.x+b.velocity.z*b.velocity.z);
this.visual.root.position.set(p.x,p.y-CFG.feetOff,p.z);
this.visual.root.rotation.y=this.visYaw;
this.visual.anim(dt,spd,this.groundedInfo?this.groundedInfo.grounded:false,this.crouchAmt);
this.visual.setBuff(this.buffT>0);
this.visual.drawName(this.health);
this.syncHitRoot();
this.hitRoot.position.y=p.y-CFG.feetOff;
this.hitRoot.position.x=p.x;this.hitRoot.position.z=p.z;
this.hitRoot.rotation.y=this.visYaw;
}
}
