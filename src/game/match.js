// Match state: rounds, scoring, economy and the buy window.
import {CFG,SETTINGS,DIFFS,TEAM_HEX,TEAM_CSS,TEAM_NAME,ECONOMY,KILL_REWARD} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,INPUT,UI,WPN,MATCH,BOTMAN,WORLD,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS,GEAR,defaultPistol} from './weapons.js';
import {MODES} from './modes.js';
import {ARENAS} from '../world/maps.js';
import {NET2} from '../net/p2p.js';

// How far from a spawn point still counts as "in spawn" for late buying.
const SPAWN_BUY_R2=9*9;

export class MatchController{
constructor(){this.reset()}
reset(){
this.mode=MODES.defuse;this.phase="idle";this.timeLeft=0;this.warmT=0;this.remote=false;
this.scores={t1:0,t2:0,top:0};this.cpOwner=0;this.cpProg=0;
this.respawnQ=[];this.sudden=false;this.endPending=false;this.voteTimer=-1;
this.lastShooter=null;this.lastShotT=-9;this._evalT=0;
}
start(mapId,modeId){
this.mode=Object.assign({},MODES[modeId]||MODES.defuse);
this.mode.teamSize=U.clamp(SETTINGS.teamSize,1,5);
this.mapId=mapId;this.def=ARENAS[mapId];
this.scores={t1:0,t2:0,top:0};this.cpOwner=0;this.cpProg=0;
this.respawnQ.length=0;this.sudden=false;this.endPending=false;this.voteTimer=-1;
this.lastShooter=null;this.lastShotT=-9;this._evalT=0;
this.mode.init(this);
if(this.mode.roundBased){
this.phase="warmup";this.timeLeft=this.mode.roundTime;
this.mode.roundPhase="pending";
}else{
this.phase="warmup";this.warmT=3.2;this.timeLimit=this.mode.timeLimit;this.timeLeft=this.mode.timeLimit;
}
UI.hideEnd();
UI.cpWidget(null);
}
/**
 * Buying is allowed while frozen, for `buyTime` seconds after the round goes
 * live, and -- past that -- only if you are still standing in your own spawn
 * zone and have not moved yet this round. Leaving spawn closes the shop for
 * good, so you cannot re-buy mid-fight.
 */
canBuy(ent){
  if(!ent||!ent.alive)return false;
  const m=this.mode;
  if(!m.roundBased)return false;
  if(m.roundPhase==="freeze")return true;
  if(m.roundPhase!=="live")return false;
  // `this.buyT` is authoritative (mode is a per-match copy).
  if((this.buyT||m.buyT||0)>0)return true;
  return this.inHomeSpawn(ent)&&!ent.leftSpawn;
}

/** True while the entity is inside the radius of one of its team's spawns. */
inHomeSpawn(ent){
  if(!WORLD||!WORLD.spawns||!ent.body)return false;
  const list=WORLD.spawns[ent.team]||[];
  const p=ent.body.position;
  for(const s of list){
    const dx=p.x-s.p.x,dz=p.z-s.p.z;
    if(dx*dx+dz*dz<SPAWN_BUY_R2)return true;
  }
  return false;
}

/** Called each tick: latches `leftSpawn` the first time you step outside. */
trackSpawnExit(ent){
  if(!ent||!ent.alive)return;
  if(ent.leftSpawn)return;
  if(!this.inHomeSpawn(ent))ent.leftSpawn=true;
}

/** Hook for per-frame shot bookkeeping. Kept as a no-op seam. */
lastShotCheck(p){}

registerKill(src,victim,info){
if(this.endPending||this.remote)return;
if(this.mode.onKill)this.mode.onKill(this,src,victim);
const killer=src&&src!==victim&&!src.isEnv?src:null;
if(killer){
if(MATCH.mode.roundBased){
const wcfg=killer.currentCfg();
const reward=wcfg?(KILL_REWARD[wcfg.id]!==undefined?KILL_REWARD[wcfg.id]:300):300;
killer.money=Math.min(16000,(killer.money||0)+reward);
}
const wname=(info&&info.weapon)||killer.currentCfg().name;
UI.feed(killer,victim,wname,!!(info&&info.head));
}else{
UI.feed(null,victim,(info&&info.weapon)||"ELIMINATED",false);
}
AUDIO.play("kill",{pos:victim.body?victim.body.position:null,vol:.5});
if(src&&src!==victim){
const now=engine.time;
if(now-src.lastKillT<4.2){src.streak++;}else src.streak=1;
src.lastKillT=now;
if(src===engine.player){
UI.hitmark(true,!!(info&&info.head));
if(src.streak===2)UI.announce("DOUBLE KILL");
else if(src.streak===5)UI.announce("KILLING SPREE","5 ELIMINATIONS");
else if(src.streak===10)UI.announce("RAMPAGE","10 ELIMINATIONS \u00B7 UNSTOPPABLE");
}
if(engine.combatants.filter(c=>c.stats.k>0).length===1&&src.stats.k===1)UI.announce("FIRST BLOOD",src.name);
}else{
victim.streak=0;
UI.feed(null,victim,"SELF-TERMINATED",false);
}

MATCH.lastShooter=null;
if(this.sudden){
this.finish(src&&src.team?"t"+src.team:(src&&src!==victim?src:null),victim);
return;
}
this.checkEnd();
}
checkEnd(){
if(this.endPending||this.remote||this.phase!=="live")return;
if(this._evalT>engine.time)return;
this._evalT=engine.time+.25;
const res=this.mode.evaluate(this);
if(res)this.finish(res,null);
}
finish(winner,victim){
if(this.endPending)return;
this.endPending=true;
this.phase="end";
let data={type:"draw",draw:true,sub:"THE ARENA FALLS SILENT"};
if(typeof winner==="string"){
data={type:"team",id:winner,draw:false,
sub:this.mode.id==="defuse"?(winner==="t1"?"COUNTER-TERRORISTS TAKE THE MATCH":"TERRORISTS TAKE THE MATCH"):(winner==="t1"?"CYAN SQUAD PREVAILS":"ORANGE SQUAD PREVAILS")};
}else if(winner){
data={type:"player",ent:winner,draw:false,sub:winner.name+" RULES THE ARENA"};
}
AUDIO.fanfare(data.type==="player"?data.ent===engine.player:data.id==="t"+(engine.player?engine.player.team:0));
UI.announce(data.draw?"DRAW":data.type==="team"?(data.id==="t1"?"CYAN VICTORY":"ORANGE VICTORY"):"VICTORY",data.sub);
setTimeout(()=>{
INPUT.unlock();
UI.scoreboard(false);
const rows=[...engine.combatants].sort((a,b)=>(b.stats.k-a.stats.k)||b.stats.dmg-a.stats.dmg).slice(0,10).map(r=>[r.name,r.stats.k,r.stats.d,Math.round(r.stats.dmg),r===engine.player?1:0]);
const meWin=data.type==="player"?data.ent===engine.player:(data.type==="team"?data.id==="t"+engine.player.team:false);
NET2.sendEv({e:"end",title:data.draw?"STALEMEET":meWin?"VICTORY":"DEFEAT".replace("DEFEAT",meWin?"VICTORY":"DEFEAT"),sub:data.sub,lost:!meWin&&!data.draw,draw:data.draw,rows:rows});
UI.endScreen(data,mapId=>engine.startMatch(mapId,this.mode.id));
this.voteTimer=12;
},1600);
}
tick(dt){
if(this.remote){this.remoteTick(dt);return}
if(this.mode.roundBased){
if(this.phase==="end"){this.endVoteTick(dt);return}
this.mode.roundTick(this,dt);
return;
}
if(this.phase==="end"){this.endVoteTick(dt);return}
if(this.phase==="warmup"){
this.warmT-=dt;
const n=Math.ceil(this.warmT);
if(n!==this._lastWarm){
this._lastWarm=n;
if(n>0)UI.announce(""+n,"PREPARE FOR DEPLOYMENT");
else{UI.announce("FIGHT","");AUDIO.play("beep")}
}
if(this.warmT<=0){this.phase="live";UI.toast("GO! GO! GO!")}
return;
}
if(this.phase!=="live")return;
this.timeLeft-=dt;
if(this.mode.onTick)this.mode.onTick(this,dt);
for(let i=this.respawnQ.length-1;i>=0;i--){
const r=this.respawnQ[i];
r.t-=dt;
if(r.t<=0){
this.respawnQ.splice(i,1);
this.spawnEntity(r.ent);
}
}
if(this.timeLeft<=0&&!this.sudden&&!this.endPending){
const res=this.mode.evaluate(this);
if(res){this.finish(res,null);return}
this.sudden=true;
UI.announce("SUDDEN DEATH","NEXT ELIMINATION DECIDES ALL");
AUDIO.play("beep");
}
this.checkEnd();
}
remoteTick(dt){
const s=NET2.lastSnap;
if(!s)return;
this.phase=s.ph;this.timeLeft=s.tl;
this.scores.t1=s.s1;this.scores.t2=s.s2;
this.mode.round=s.round;this.mode.bombState=s.bst;this.mode.siteName=s.bsite;
if(s.bx||s.by||s.bz){this.mode.bombPos=this.mode.bombPos||new THREE.Vector3();this.mode.bombPos.set(s.bx,s.by,s.bz)}
if(NET2.meHp&&engine.player){engine.player.health=NET2.meHp[0];engine.player.shield=NET2.meHp[1]}
}
endVoteTick(dt){
if(this.voteTimer>0){
this.voteTimer-=dt;
UI.endTimer(Math.ceil(Math.max(0,this.voteTimer)));
if(this.voteTimer<=0){
let best=null,bn=-1;
for(const id in UI._votes){if(UI._votes[id]>bn){bn=UI._votes[id];best=id}}
if(!best)best=U.pick(Object.keys(ARENAS));
this.voteTimer=-1;
UI.hideEnd();
this.endPending=false;
engine.startMatch(best,this.mode.id);
}
}
}
spawnEntity(c){
let pool=MATCH.mode.teams&&c.team?WORLD.spawns[c.team]:WORLD.spawns.ffa.concat(WORLD.spawns[1],WORLD.spawns[2]);
if(!pool.length)pool=WORLD.spawns.ffa;
let best=pool[0],bd=-1;
for(const s of U.pick?pool:pool){
let dMin=1e9;
for(const e of engine.combatants){
if(e===c||!e.alive)continue;
dMin=Math.min(dMin,e.body.position.distanceTo(s.p));
}
if(MATCH.mode.teams&&c.team){
for(const e of engine.combatants){
if(!e.alive||e.team!==c.team)continue;
dMin+=Math.min(8,e.body.position.distanceTo(s.p))*.3;
}
}
const sc=dMin+U.rand(0,6);
if(sc>bd){bd=sc;best=s}
}
if(c.body)c.body.velocity.set(0,0,0);
c.spawnAt(best);
if(c===engine.player){
GFX.setFovInstant(U.lerp(SETTINGS.fov,c.currentCfg().adsFov,0));
UI.slotsDirty=true;
FX.flash(_va.copy(best.p).setY(best.p.y+1),0x35d6ff,2);
}
}
}