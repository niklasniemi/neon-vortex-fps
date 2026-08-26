// AI operator. A utility FSM over the nav graph, with per-round objectives
// handed down by the match controller.
import {CFG,GRP,SETTINGS,DIFFS,BOT_NAMES,TEAM_HEX} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,UI,WPN,MATCH,BOTMAN,WORLD,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS,NADE_ORDER,defaultPistol,standardLoadout,botPickPrimary} from '../game/weapons.js';
import {Combatant} from './combatant.js';
import {buildCharMesh} from './charmesh.js';

/** How long a sighting of the bomb carrier keeps the CT side rotating. */
const CT_INTEL_HOLD=14;

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
this.slideDir=0;this.stuckRetries=0;
this.progBest=undefined;this.progT=0;this.detourUntil=0;
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

// Seeing the bomb carrier is information the whole CT side acts on -- it is
// what turns a static hold into a rotation. Kept fresh for a while, then
// allowed to go stale so they do not chase forever.
if(this.team===1&&best.hasBomb&&best.body){
if(!MATCH.ctIntelPos)MATCH.ctIntelPos=new THREE.Vector3();
MATCH.ctIntelPos.copy(best.body.position);
MATCH.ctIntelT=engine.time+CT_INTEL_HOLD;
}
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
/**
 * Routes to a world position and remembers what it was routing to, so the path
 * is only thrown away when it is actually invalid.
 */
goToRaw(pos){
this.path=BOTMAN.findPath(this.body.position,pos);
this.pathI=0;
this.repathT=6;
this.pathGoal=pos.clone?pos.clone():new THREE.Vector3(pos.x,pos.y,pos.z);
// A* starts from the nearest node, which can be a step backwards. Drop that
// one waypoint if so -- but only one, or a curving route gets gutted.
if(this.path&&this.path.length>1){
const here=this.body.position;
if(this.path[0].distanceToSquared(here)>this.path[1].distanceToSquared(here))
this.path.shift();
}
}

/**
 * Is the straight line between two points actually walkable?
 * Samples the collision field for a floor within step height and standing
 * clearance the whole way. Without this a bot happily walks into a wall
 * because the goal is "close".
 */
walkableLine(from,to){
const SF=WORLD&&WORLD.spans;
if(!SF)return true;
const dx=to.x-from.x, dz=to.z-from.z;
const d=Math.hypot(dx,dz);
if(d<.05)return true;
const steps=Math.min(24,Math.max(2,Math.ceil(d/.6)));
let last=from.y-CFG.feetOff;
for(let i=1;i<=steps;i++){
const t=i/steps;
const x=from.x+dx*t, z=from.z+dz*t;
const s=SF.spanAt(x,z,last+CFG.stepMax,CFG.stepMax);
if(!s)return false;
if(Math.abs(s.floor-last)>CFG.stepMax+.05)return false;
if(s.ceil-s.floor<CFG.standHeight)return false;
last=s.floor;
}
return true;
}

/**
 * Walks toward a world point, going around obstacles rather than into them.
 *
 * The old code dropped pathfinding entirely inside 5m and drove straight at
 * the goal, which is why bots parked against walls near their post -- CT bots
 * most of all, since their objectives sit right on the bombsites.
 *
 * @returns {boolean} true once within `arrive` metres
 */
moveToward(goal,dt,arrive){
if(!goal)return false;
_vd.subVectors(goal,this.body.position);_vd.y=0;
const d=_vd.length();
if(d<=(arrive||1.1)){
this.ctrl.mz=0;this.ctrl.mx=0;
this.faceYaw(Math.atan2(-_vd.x,-_vd.z),dt,this.diff.turn*.9);
this.path=null;
return true;
}
// A short, provably clear hop is worth taking directly; anything else routes
// through the nav graph.
if(d<8&&this.walkableLine(this.body.position,goal)){
this.path=null;
this.faceYaw(Math.atan2(-_vd.x,-_vd.z),dt,this.diff.turn*.9);
this.ctrl.mz=1;this.ctrl.mx=0;
return false;
}
// Only rebuild the route when it is genuinely no longer usable. Repathing on
// a timer while a good path is half-walked made bots oscillate: each new
// search could start from a node behind them and undo the last few metres.
// No timer-based repathing. Waypoints can be ten metres apart, so a bot only
// clears one or two every few seconds -- rebuilding the route on a clock meant
// it perpetually restarted near the beginning and never finished a journey.
// A route is replaced only when it is finished, aimed somewhere else, or the
// stuck handler has thrown it away.
const stale=!this.path||this.pathI>=this.path.length;
const moved=this.pathGoal&&this.pathGoal.distanceToSquared(goal)>4;

// Progress watchdog. Being blocked does not always look like being stuck --
// a bot can hold a valid path, keep signalling movement, and still make no
// headway at a pinch point. Watch the distance to the objective instead: if it
// has not improved in a while, the current plan is not working, so route via
// somewhere else entirely and approach from a different direction.
if(this.progBest===undefined||moved){this.progBest=d;this.progT=0}
if(d<this.progBest-.5){this.progBest=d;this.progT=0}
else this.progT=(this.progT||0)+dt;
let detour=false;
if(this.progT>6){
this.progT=0;this.progBest=d;
const via=BOTMAN.randomNode(true);
if(via&&via.p.distanceTo(this.body.position)>4){
this.goToRaw(via.p);
this.detourUntil=engine.time+5;      // commit to it briefly
detour=true;
}
}
if(!detour&&engine.time>(this.detourUntil||0)&&(stale||moved)){
// Route to the nearest nav node we can actually reach that is close to the
// goal, not to the goal itself. Pathing to a bare world point often produced
// a route made entirely of waypoints already within arrival range: followPath
// consumed them all, returned nothing, the path was discarded, and the whole
// thing repeated every frame with the bot standing still.
const via=BOTMAN.reachableNode(this.body.position,goal);
this.goToRaw(via?via.p:goal);
}

if(!this.followPath(dt)){
// End of the route. Close the last gap on foot when it is clear; otherwise
// hand it to the stuck handler rather than spinning on a dead path.
if(this.walkableLine(this.body.position,goal)){
_vd.subVectors(goal,this.body.position);_vd.y=0;
this.faceYaw(Math.atan2(-_vd.x,-_vd.z),dt,this.diff.turn*.9);
this.ctrl.mz=1;this.ctrl.mx=0;
}else{
// Aim at the last waypoint we do have, so we keep moving while the stuck
// handler works out a better route.
const lastWp=this.path&&this.path.length?this.path[this.path.length-1]:null;
if(lastWp&&lastWp.distanceTo(this.body.position)>1.2){
_vd.subVectors(lastWp,this.body.position);_vd.y=0;
this.faceYaw(Math.atan2(-_vd.x,-_vd.z),dt,this.diff.turn*.9);
this.ctrl.mz=1;this.ctrl.mx=0;
}else{
this.path=null;this.ctrl.mz=0;
this.stuckT=Math.max(this.stuckT,1.0);   // let recovery escalate
}
}
}

// Failsafe: a bot with somewhere to be must never simply stand there. If none
// of the branches above produced a movement command, walk at the objective and
// let the controller's wall sliding work the rest out. Standing still is the
// one outcome that always looks broken.
if(this.ctrl.mz===0&&this.ctrl.mx===0){
_vd.subVectors(goal,this.body.position);_vd.y=0;
if(_vd.lengthSq()>.01){
this.faceYaw(Math.atan2(-_vd.x,-_vd.z),dt,this.diff.turn*.9);
this.ctrl.mz=1;
// Drift sideways as well, so a flat wall gets slid along rather than leaned on.
this.ctrl.mx=this.slideDir||0;
}
}
return false;
}
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
if(this.objRole==="retrieve"&&md.bombState==="dropped")
this.objPoint=md.bombPos?md.bombPos.clone():this.objPoint;

const goal=this.team===1?this.ctGoal(md):this.objPoint;
if(!goal){this.yaw+=dt*.5;this.checkStuck(dt);return}

this.ctrl.sprint=false;
const arrived=this.moveToward(goal,dt,1.1);
if(arrived){
if(this.objRole==="plant"&&md.bombState==="carried"&&this.hasBomb){
if(md.siteAt(this.body.position))this.ctrl.plantE=true;
}
if(this.team===1&&md.bombState==="planted"&&md.bombPos){
if(this.body.position.distanceTo(md.bombPos)<1.7)this.ctrl.plantE=true;
}
}
this.checkStuck(dt);
}

/**
 * Where a counter-terrorist should be right now.
 *
 * Three tiers, most urgent first:
 *   1. Bomb planted    - it beeps, so every CT knows. All of them converge to
 *                        contest the site and defuse it.
 *   2. Bomb located    - a CT has seen the carrier, or it lies dropped in the
 *                        open. Rotate onto that, but let the intel go stale.
 *   3. Nothing known   - hold your assigned post (A, B or mid).
 *
 * @returns {THREE.Vector3|null}
 */
ctGoal(md){
if(md.bombState==="planted"&&md.bombPos)return md.bombPos;

const M=MATCH;
if(md.bombState==="dropped"&&md.bombPos)return md.bombPos;
if(M.ctIntelPos&&engine.time<M.ctIntelT)return M.ctIntelPos;

return this.objPoint;
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
// groundedInfo only exists once applyMove has run at least once; a bot that
// paths on its very first tick would crash here otherwise.
if(nxt.y>this.body.position.y+.5&&hd<2.4&&this.groundedInfo&&this.groundedInfo.grounded)this.jumpPulse=true;
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

// Escalating recovery. Pressing into a wall for a second and a half used to
// just re-issue the same path, so a bot could grind against a corner for the
// whole round.
if(this.stuckT>.35){
// First: commit to one side rather than jittering left and right.
if(!this.slideDir||this.stuckT<.4)this.slideDir=Math.random()<.5?-1:1;
this.ctrl.mx=this.slideDir;
}
if(this.stuckT>.9)this.jumpPulse=true;      // maybe it is a lip, not a wall
if(this.stuckT>1.4){
this.stuckT=0;this.repathT=0;this.path=null;this.slideDir=0;
// Route from a nav node we can actually reach instead of from inside the
// obstacle, and pick a fresh one so we stop retrying the same blocked line.
const detour=BOTMAN.nearestNode(this.body.position);
const goal=(MATCH.mode.roundBased&&this.objPoint)?this.objPoint:null;
if(goal){
this.path=BOTMAN.findPath(detour?detour.p:this.body.position,goal);
this.pathI=0;this.repathT=2.8;
this.stuckRetries=(this.stuckRetries||0)+1;
// Still jammed after several attempts: take a random node first to break
// out of the pocket entirely, then resume.
if(this.stuckRetries>2){
this.stuckRetries=0;
const via=BOTMAN.randomNode(true);
if(via)this.goTo(via);
}
}else this.setState(this.state,this.seekFlag);
}
}else{
this.stuckT=Math.max(0,this.stuckT-dt*2);
this.slideDir=0;
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
