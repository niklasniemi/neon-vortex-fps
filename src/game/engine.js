// Game loop and match bootstrap.
import {CFG,GRP,SETTINGS,DIFFS,TEAM_HEX,TEAM_CSS} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,INPUT,UI,WPN,MATCH,NET,BOTMAN,WORLD,engine,setWORLD} from '../core/globals.js';
import {ArenaBuilder,groundYAt} from '../world/arena.js';
import {ARENAS} from '../world/maps.js';
import {SpanField} from '../world/collision.js';
import {buildGLBArena} from '../world/glb.js';
import {placeProps,addSiteMarkers} from '../world/props.js';
import {buildAutoNav} from '../world/navmesh.js';
import {Player} from '../entities/player.js';
import {pushApart} from '../entities/movement.js';
import {NET2} from '../net/p2p.js';
import {NetProxy} from '../net/netentities.js';

let loopErrT=0;

export class GameEngine{
constructor(){
this.state="boot";
this.paused=false;
this.entities=[];
this.combatants=[];
this.player=null;
this.time=0;this.frame=0;this.dt=.016;
this.clock=new THREE.Clock();
}
add(e){this.entities.push(e)}
deploy(mapId,modeId){
if(this.state==="playing")return;
this.state="loading";
UI.showMenu(false);
UI.loading(true,"COMPILING "+ARENAS[mapId].label);
NET.connect().then(online=>{
UI.netStatus(online?"LINKED":"OFFLINE SIM",online);
});
setTimeout(()=>this.startMatch(mapId,modeId),60);
}
cleanup(){
for(const e of this.entities)e.destroy();
for(const c of this.combatants){
if(c.visual)GFX.scene.remove(c.visual.root);
if(c.hitRoot)GFX.scene.remove(c.hitRoot);
}
this.entities.length=0;this.combatants.length=0;
while(GFX.camera.children.length)GFX.camera.remove(GFX.camera.children[0]);
if(WORLD){
GFX.scene.remove(WORLD.group);
WORLD.group.traverse(o=>{
if(o.geometry)o.geometry.dispose();
});
PHYS.colliders.length=0;
const _bodies=PHYS.world.bodies.slice();
for(const _b of _bodies){try{if(_b.world)PHYS.world.removeBody(_b)}catch(e){}}
PHYS.removeQueue.length=0;
FX.scroll.length=0;
setWORLD(null);
}
NET.dispose();
this.player=null;
if(MATCH&&MATCH._bombMesh){GFX.scene.remove(MATCH._bombMesh);MATCH._bombMesh=null;MATCH._led=null}
AUDIO.stopAmbient();
UI.el.feed.innerHTML="";
UI.cpWidget(null);
UI.objShow("");
UI.progHide();
UI.respawnHide();
}
async startMatch(mapId,modeId){
try{
this.cleanup();
const def=ARENAS[mapId];
let spans=null;
UI.loading(true,"GENERATING "+def.label);
PHYS.setGravity(def.grav);
const b=new ArenaBuilder();
if(def.glb){
if(!window.THREE||!THREE.GLTFLoader){UI.loading(true,"GLTF LOADER UNAVAILABLE");return}
try{
await buildGLBArena(def,b);
PHYS.colliders.length=0;
for(const cm of b.colliders)PHYS.colliders.push(cm);

// Collision field must exist before props so they can stamp themselves
// into it, and before nav so bots path over what the props add.
UI.loading(true,"BUILDING COLLISION");
await new Promise(r=>setTimeout(r,0));
spans=new SpanField(def.aabb).build(b.colliders);

UI.loading(true,"PLACING GEOMETRY");
placeProps(b,def,spans);
PHYS.colliders.length=0;
for(const cm of b.colliders)PHYS.colliders.push(cm);

UI.loading(true,"BUILDING NAVIGATION");
await new Promise(r=>setTimeout(r,0));
buildAutoNav(b,def,spans);
}catch(e){
console.error("map build failed:",e);
UI.loading(true,"MAP FAILED TO LOAD \u2014 "+(e&&e.message||e));
this.state="menu";UI.showMenu(true);
return;
}
}else{
def.build(b);
PHYS.colliders.length=0;
for(const cm of b.colliders)PHYS.colliders.push(cm);
}
setWORLD({
def:def,
group:b.group,
bounds:b.bounds,
spawns:b.spawns,
spans:spans,
navDefs:b.navDefs,
navLinks:b.navLinks,
mmRects:b.mmRects,
minimap:spans?spans.renderMinimap():null,
smokes:[],fires:[]
});
GFX.scene.add(b.group);
GFX.setupArena(def,b.bounds);
addSiteMarkers(def,b.group,spans);
BOTMAN.buildNav();
MATCH.reset();
MATCH.start(mapId,modeId);
this.player=new Player(SETTINGS.name);
this.player.team=NET2.joined?NET2.guestTeam():(NET2.lobby.hostTeam||(SETTINGS.side==="ct"?1:2));
this.player.accent=TEAM_HEX[this.player.team];
this.player.applyTeamLoadout(null);
this.add(this.player);
this.combatants.push(this.player);
MATCH.spawnEntity(this.player);

if(NET2.joined){
MATCH.remote=true;
this.player.puppet=true;
NET2.idxMap={};
let pi=0;
for(const r of NET2.roster){
if(r.i===NET2.youIdx)continue;
const px=new NetProxy(r);
NET2.idxMap[r.i]=px;
this.add(px);this.combatants.push(px);
}
UI.netStatus("P2P GUEST \u00B7 "+NET2.code,true);
}else{
// The guest occupies a real slot, so spawn them FIRST and let the lobby's
// bot counts stand as-is. Deriving the enemy count from team size is what
// used to put a bot on your friend's team in a 1v1.
if(NET2.isHost&&(NET2.connected||NET2._pendingGuest)){NET2._pendingGuest=false;NET2.spawnGuest()}
NET.spawnBotsForMatch(NET2.composition());
if(MATCH.mode.roundBased)MATCH.mode.startRound(MATCH);
}
UI.refreshSlots(this.player.slots.length);
AUDIO.ambient(def.amb);
this.state="playing";
this.paused=false;
UI.loading(false);
UI.showHUD(true);
UI.slotsDirty=true;
UI.netStatus(NET.online?"LINKED":"OFFLINE SIM",NET.online);
UI.toast(INPUT.locked?"":"CLICK TO TAKE CONTROL");
this.clock.getDelta();
}catch(e){console.error("[sm] FATAL",e.message);UI.loading(true,"MATCH ERROR: "+e.message);this.state="menu";UI.showMenu(true)}
}
pause(on){
if(this.state!=="playing")return;
this.paused=on;
UI.pauseShow(on);
if(on)INPUT.unlock();
else INPUT.lock(GFX.renderer.domElement);
}
quitToMenu(){
NET2.cleanup();
NET2.status("NOT CONNECTED");
this.cleanup();
this.state="menu";
this.paused=false;
UI.pauseShow(false);
UI.showHUD(false);
UI.scoreboard(false);
UI.scope(false);
UI.critVig(false);
UI.powShow(false);
UI.showMenu(true);
INPUT.unlock();
document.body.style.cursor="";
}
loop(){
requestAnimationFrame(()=>this.loop());
const rawDt=Math.min(.05,this.clock.getDelta());
this.frame++;
if(this.state!=="playing"){
if(this.state==="menu")GFX.render(rawDt);
return;
}
if(this.paused){GFX.render(rawDt);INPUT.frameClear();return}
this.dt=rawDt;
this.time+=rawDt;
try{
INPUT.anyGesture=false;
if(INPUT.locked)document.body.style.cursor="none";
else document.body.style.cursor="";
MATCH.tick(rawDt);
NET.update(rawDt);
if(engine.player&&engine.player.alive)MATCH.lastShotCheck(engine.player);
for(const c of this.combatants){
if(!c.alive)continue;
c.protectT=Math.max(0,c.protectT-rawDt);
c.buffT=Math.max(0,c.buffT-rawDt);
c.regen(rawDt);
MATCH.trackSpawnExit(c);
this.checkTriggers(c,rawDt);
}
for(const b of this.combatants)if(b.isBot||b.remote)b.update(rawDt);
if(WORLD&&(WORLD.fires&&WORLD.fires.length||WORLD.smokes&&WORLD.smokes.length)){
for(let i=WORLD.fires.length-1;i>=0;i--){
const f=WORLD.fires[i];
f.t-=rawDt;f.sn-=rawDt;
if(f.sn<=0){f.sn=.45;AUDIO.play("firecrack",{pos:f.p,vol:.5})}
for(const c of this.combatants){
if(!c.alive||!c.bodyInWorld)continue;
const dx=c.body.position.x-f.p.x,dz=c.body.position.z-f.p.z;
if(dx*dx+dz*dz<f.r*f.r&&c.body.position.y-CFG.feetOff<f.p.y+1){
c.takeDamage(14*rawDt,null,{env:true,noText:true,weapon:"FIRE",point:_va.copy(c.body.position).setY(c.body.position.y)});
if(Math.random()<.06)FX.preset("ember",_va.copy(c.body.position),{count:2});
}
}
if(f.t<=0)WORLD.fires.splice(i,1);
}
for(let i=WORLD.smokes.length-1;i>=0;i--){
const sm=WORLD.smokes[i];
sm.t-=rawDt;
if(sm.t<=0)WORLD.smokes.splice(i,1);
}
}
if(WORLD&&WORLD.spans)pushApart(this.combatants);
if(NET2.isHost&&NET2.connected){
const now=performance.now();
if(now-NET2._snapT>66){NET2._snapT=now;NET2.sendSnap(NET2.buildSnap())}
}
if(this.player)this.player.update(rawDt);
for(let i=this.entities.length-1;i>=0;i--){
const e=this.entities[i];
e.update(rawDt);
if(e.dead)this.entities.splice(i,1);
}
PHYS.step(rawDt);
FX.update(rawDt);
GFX.updatePlayerCamera(this.player,rawDt);
AUDIO.updateListener(GFX.camera);
UI.update(rawDt);
if(NET2.joined&&NET2.lastSnap)NET2.applyEnts(NET2.lastSnap);
INPUT.frameClear();
GFX.render(rawDt);
}catch(e){if(!loopErrT||engine.time-loopErrT>3){loopErrT=engine.time;console.error("[loop] ERR",e.message,(e.stack||"").split("\n").slice(1,5).join(" | "))}}
}
lastShotCheck(p){}
/** Environmental hazards. Lava, jump pads and teleporters are gone. */
checkTriggers(c,dt){
  const bp=c.body.position;
  if(bp.y<(WORLD&&WORLD.def.aabb?WORLD.def.aabb.min[1]-14:-26)){
    c.takeDamage(999,null,{env:true,weapon:"FELL OUT OF THE WORLD",fromPos:null});
  }
}
}
