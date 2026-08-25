// Bomb Defusal -- the only game mode. The arcade modes (free-for-all, team
// deathmatch, control point) are gone along with their pickups and score rules.
import {CFG,SETTINGS,TEAM_HEX,TEAM_NAME,ECONOMY} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,UI,WPN,MATCH,BOTMAN,WORLD,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS,GEAR,botPickPrimary,defaultPistol} from './weapons.js';
import {TexFac,matStd} from '../render/textures.js';
import {refreshLoadout} from './economy.js';
import {NET2} from '../net/p2p.js';

export const MODES={
defuse:{
id:"defuse",label:"BOMB DEFUSAL",teams:true,teamSize:5,killLimit:0,
roundsToWin:8,roundTime:115,bombTime:40,plantTime:3.2,defuseTime:5,respawn:0,roundBased:true,
// CS timings: 15s frozen at spawn, and the buy menu stays open for 20s from
// round start. After that you can still buy while you are in your spawn zone
// and have not moved yet -- see MatchController.canBuy().
freezeTime:15,buyTime:20,
init(m){
m.scores={t1:0,t2:0};m.round=0;m.roundPhase="freeze";m.phaseT=this.freezeTime;m._lastN=99;
m.bombState="idle";m.bombPos=null;m.carrier=null;
m.plantProg=0;m.defuseProg=0;m.bombT=0;m.beepT=0;m.siteName="";m.sitePlan="A";
m._lastN=99;m._bombMesh=null;m._led=null;
},
startRound(m){
m.round++;
m.roundPhase="freeze";m.phaseT=this.freezeTime;m._lastN=99;m.buyT=this.buyTime;
m.bombState="carried";m.plantProg=0;m.defuseProg=0;m.siteName="";
m.respawnQ.length=0;
UI.progHide();
for(const e of engine.entities)if(e.type==="proj"||e.type==="nade")e.destroy();
if(WORLD){WORLD.smokes=[];WORLD.fires=[]}
if(FX){for(const s2 of FX.smokePlumes)GFX.scene.remove(s2.grp);FX.smokePlumes.length=0;
for(const f2 of FX.firesV)GFX.scene.remove(f2.grp);FX.firesV.length=0}
this.bombHide(m);
const ctSp=WORLD.spawns[1]||[],tSp=WORLD.spawns[2]||[];
let ci=0,ti=0;
for(const c of engine.combatants){
const pool=c.team===1?ctSp:tSp;
if(!pool.length)continue;
const sp=pool[(c.team===1?ci++:ti++)%pool.length];
if(c.body)c.body.velocity.set(0,0,0);
c.spawnAt(sp);
c.hasBomb=false;c.objPoint=null;
if(NET2.isHost&&c===NET2.guestEnt)NET2.sendEv({e:"resp",x:+c.body.position.x.toFixed(2),y:+c.body.position.y.toFixed(2),z:+c.body.position.z.toFixed(2)});
}
NET2.sendEv&&NET2.isHost&&NET2.sendEv({e:"rr"});
const ts=engine.combatants.filter(c=>c.team===2&&c.alive);
m.carrier=ts.find(c=>c===engine.player)||U.pick(ts)||null;
if(m.carrier)m.carrier.hasBomb=true;
const pistolRound=(m.round===1||m.round===13);
for(const c of engine.combatants){
// Dying costs you everything you bought. This used to read
// SETTINGS.loadout.start, which no longer exists -- it threw from round two
// onward and took the whole round-start routine down with it.
if(c.lostGear||pistolRound){
refreshLoadout(c,true);
c.nadeMode=false;
if(c===engine.player){
for(const id in c.vms)c.vms[id].visible=false;
const vm=c.getVM(c.currentCfg().id);
if(vm)vm.visible=true;
UI.slotsDirty=true;
}
}else{
c.lostGear=false;c.leftSpawn=false;c.refillAmmo();
}
if(c.isBot)this.botBuy(c);
}
m.sitePlan=U.pick(["A","B"]);
let ctIdx=0;
for(const c of engine.combatants){
if(!c.isBot||!c.alive)continue;
if(c.team===2){
const r=Math.random();
if(c===m.carrier){c.objRole="plant";c.objSite=m.sitePlan}
else if(r<.75){c.objRole="escort";c.objSite=m.sitePlan}
else{c.objRole="flank";c.objSite=m.sitePlan==="A"?"B":"A"}
}else{
ctIdx++;
if(ctIdx===1){c.objRole="roam";c.objSite="MID"}
else{c.objSite=ctIdx%2?"A":"B";c.objRole="hold"+c.objSite}
}
c.objPoint=this.rolePoint(m,c);
c.rotateAt=m.roundTime-45;
}
const youT=engine.player.team===2;
const sA=WORLD.def.sites.find(s=>s.name==="A"),sB=WORLD.def.sites.find(s=>s.name==="B");
UI.announce("ROUND "+m.round,youT?(m.carrier===engine.player?"YOU HAVE THE BOMB \u2014 PLANT AT A OR B":"ESCORT THE BOMB \u2014 TARGET SITE "+m.sitePlan):"DEFEND SITES A & B \u2014 STOP THE PLANT");
UI.toast("SITES: A @ X"+sA.x.toFixed(0)+" Z"+sA.z.toFixed(0)+" \u00B7 B @ X"+sB.x.toFixed(0)+" Z"+sB.z.toFixed(0)+" \u00B7 F9 = COORD GRID");
if(m.carrier===engine.player)UI.toast("HOLD E INSIDE SITE A OR B TO PLANT \u00B7 40s FUSE");
AUDIO.play("beep");
},
botBuy(c){
// Armour first, then a primary the wallet can carry, then utility --
// roughly the order a real player buys in.
if(c.armour<50&&c.money>=1000){c.money-=1000;c.armour=100;c.helmet=true}
else if(c.armour<50&&c.money>=650){c.money-=650;c.armour=100;c.helmet=false}
if(c.team===1&&!c.hasDefuser&&c.money>=400){c.money-=400;c.hasDefuser=true}
const primary=botPickPrimary(c.money,c.team);
if(primary&&c.money>=WEAPONS[primary].price){c.money-=WEAPONS[primary].price;c.setPrimary(primary)}
for(const n of["flash","he","smoke"]){
const pr=NADE_DEFS[n].price;
if(c.money>=pr&&c.nades[n]<1){c.money-=pr;c.nades[n]++}
}
},
rolePoint(m,c){
const pickSite=n=>WORLD.def.sites.find(s=>s.name===n)||WORLD.def.sites[0];
let s;
if(c.objRole==="plant")s=pickSite(c.objSite);
else if(c.objRole==="escort")s=pickSite(c.objSite);
else if(c.objRole==="flank")s=pickSite(c.objSite==="A"?"B":"A");
else if(c.objRole==="defuse")return m.bombPos?m.bombPos.clone():pickSite(c.objSite||"A").clone();
else if(c.objRole==="roam"){const n=BOTMAN.nearestNode(new THREE.Vector3(0,0,0));return n?n.p.clone():new THREE.Vector3(0,0,0)}
else s=pickSite(c.objRole==="holdA"?"A":"B");
const node=BOTMAN.nearestNode(new THREE.Vector3(s.x,0,s.z));
const base=node?node.p:new THREE.Vector3(s.x,0,s.z);
if(c.objRole==="plant"){const s2=pickSite(c.objSite);return new THREE.Vector3(s2.x,base.y,s2.z)}
const a=U.rand(0,6.283),r=U.rand(2.5,5);
return new THREE.Vector3(base.x+Math.cos(a)*r,base.y,base.z+Math.sin(a)*r);
},
siteAt(pos){
if(!WORLD.def.sites)return null;
for(const s of WORLD.def.sites){
const dx=pos.x-s.x,dz=pos.z-s.z;
if(dx*dx+dz*dz<s.r*s.r)return s;
}
return null;
},
bombShow(m,pos){
if(!m._bombMesh){
const g=new THREE.Group();
const body=new THREE.Mesh(new THREE.BoxGeometry(.34,.15,.24),matStd({color:0x1a1d22,metal:.6,rough:.4}));
const led=new THREE.Sprite(new THREE.SpriteMaterial({map:TexFac.softDot(),color:0xff2434,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
led.scale.setScalar(.5);led.position.y=.16;
const ant=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.22,6),matStd({color:0x888,metal:.8,rough:.3}));
ant.position.set(.1,.18,0);
g.add(body,led,ant);
m._bombMesh=g;m._led=led;
GFX.scene.add(g);
}
m._bombMesh.visible=true;
m._bombMesh.position.copy(pos);
},
bombHide(m){
if(m._bombMesh)m._bombMesh.visible=false;
},
plantBomb(m,c,s){
m.bombState="planted";m.siteName=s.name;
m.bombPos=c.body.position.clone();m.bombPos.y+=.08;
m.bombT=this.bombTime;m.plantProg=0;m.defuseProg=0;m.beepT=0;
if(m.carrier){m.carrier.money=Math.min(16000,(m.carrier.money||0)+300);m.carrier.hasBomb=false}
m.carrier=null;
this.bombShow(m,m.bombPos);
UI.progHide();
UI.announce("THE BOMB HAS BEEN PLANTED","SITE "+s.name+" \u00B7 "+this.bombTime+"s TO DETONATION");
AUDIO.play("pk_power");
GFX.addTrauma(.3);
for(const b2 of engine.combatants){
if(!b2.isBot||!b2.alive)continue;
if(b2.team===1){b2.objRole="defuse";b2.objPoint=m.bombPos.clone();}
else{b2.objRole="hold";b2.objPoint=this.rolePoint(m,b2);}
}
},
dropBomb(m,pos){
if(m.carrier)m.carrier.hasBomb=false;
m.carrier=null;
m.bombState="dropped";
m.bombPos=pos.clone();m.bombPos.y+=.1;
this.bombShow(m,m.bombPos);
UI.toast("THE BOMB WAS DROPPED");
},
explodeBomb(m){
PHYS.explode(m.bombPos,16,420,null,20,0xffa23c,{selfMult:0});
GFX.addTrauma(1);
this.bombHide(m);
this.endRound(m,"t2","TARGET DESTROYED");
},
bombDefused(m,c){
FX.flash(m.bombPos,0x4fe3ff,3);
AUDIO.play("beep");
this.bombHide(m);
this.endRound(m,"t1","BOMB DEFUSED"+(c===engine.player?" BY "+c.name:""));
},
endRound(m,winner,label){
if(m.roundPhase==="post"||m.endPending)return;
m.roundPhase="post";m.phaseT=4.5;
m.scores[winner]=(m.scores[winner]||0)+1;
// CS economy: winners take a flat payout, losers take an escalating bonus
// that resets on a win, so a team that keeps losing can eventually re-buy.
m.lossStreak=m.lossStreak||{1:0,2:0};
const wTeam=winner==="t1"?1:2, lTeam=winner==="t1"?2:1;
m.lossStreak[wTeam]=0;
m.lossStreak[lTeam]=Math.min(ECONOMY.lossStreak.length-1,(m.lossStreak[lTeam]||0)+1);
const lossPay=ECONOMY.lossStreak[m.lossStreak[lTeam]];
for(const c of engine.combatants){
const won=c.team===wTeam;
let pay=won?ECONOMY.winRound:lossPay;
// Planting pays the whole T side even when they lose the round.
if(!won&&c.team===2&&m.bombState==="planted")pay+=ECONOMY.plantBonus;
c.money=Math.min(ECONOMY.maxMoney,(c.money||0)+pay);
// Gear does not survive a death.
if(!c.alive){c.armour=0;c.helmet=false;c.lostGear=true}
}
UI.progHide();
UI.objShow("");
const won=winner==="t"+engine.player.team;
UI.announce(winner==="t1"?"COUNTER-TERRORISTS WIN":"TERRORISTS WIN",label);
AUDIO.fanfare(won);
const res=this.evaluate(m);
if(res)MATCH.finish(res,null);
},
roundTick(m,dt){
if(m.endPending||MATCH.phase==="end")return;
MATCH.mode.roundPhase=m.roundPhase;MATCH.mode.bombState=m.bombState;MATCH.mode.siteName=m.siteName;
// Round timers live on the controller; mirror them onto the mode so the
// buy menu and HUD can read one object.
MATCH.mode.phaseT=m.phaseT;MATCH.mode.buyT=m.buyT;
MATCH.mode.carrier=m.carrier;MATCH.mode.bombPos=m.bombPos;MATCH.mode.round=m.round;
if(m.roundPhase==="pending"){MATCH.phase="warmup";return}
if(m.roundPhase==="freeze"){
MATCH.phase="warmup";
m.phaseT-=dt;
m.buyT=Math.max(0,(m.buyT||0)-dt);
MATCH.timeLeft=m.phaseT;
const n=Math.ceil(m.phaseT);
if(n!==m._lastN){
m._lastN=n;
if(n>0)UI.announce("ROUND "+m.round,n<=3?""+n:"STANDBY");
}
if(m.phaseT<=0){m.roundPhase="live";MATCH.phase="live";UI.announce("GO GO GO","");AUDIO.play("beep")}
return;
}
if(m.roundPhase==="post"){
MATCH.phase="warmup";
m.phaseT-=dt;
if(m.phaseT<=0&&!m.endPending)this.startRound(m);
return;
}
MATCH.phase="live";
m.buyT=Math.max(0,(m.buyT||0)-dt);
if(m.bombState==="planted"){
m.bombT-=dt;
MATCH.timeLeft=Math.max(0,m.bombT);
const frac=1-m.bombT/this.bombTime;
m.beepT-=dt;
if(m.beepT<=0){
m.beepT=U.lerp(1,.13,frac*frac);
AUDIO.tone(1240,.06,"square",.2);
if(m._led)m._led.material.opacity=1;
}
if(m._led)m._led.material.opacity=.25+Math.abs(Math.sin(engine.time*10));
if(m._bombMesh)m._bombMesh.rotation.y+=dt*2;
UI.objShow("\u25C6 BOMB PLANTED \u00B7 SITE "+m.siteName+" \u00B7 "+Math.ceil(m.bombT)+"s",true);
if(m.bombT<=0){this.explodeBomb(m);return}
}else{
m.roundT=(m.roundT===undefined?this.roundTime:m.roundT)-dt;
MATCH.timeLeft=Math.max(0,m.roundT);
if(m.bombState==="carried"&&m.carrier&&m.carrier.alive){
UI.objShow(m.carrier===engine.player?"\u25C6 YOU CARRY THE BOMB \u2014 PLANT AT A / B":"\u25C6 BOMB CARRIER: "+m.carrier.name,false);
}else if(m.bombState==="dropped"){
UI.objShow("\u25C6 BOMB DROPPED \u2014 TERRORISTS: RECOVER IT",true);
}else UI.objShow("ELIMINATE THE ENEMY TEAM \u00B7 "+Math.ceil(m.roundT)+"s",false);
if(m.roundT<=0&&m.bombState!=="planted"){this.endRound(m,"t1","TIME EXPIRED \u2014 SITE SAFE");return}
}
if(m.bombState==="carried"){
for(const c of engine.combatants){
if(!c.isBot||!c.alive||c.team!==2)continue;
if(c.objRole==="flank"&&m.roundT<45){c.objRole="escort";c.objSite=m.sitePlan;c.objPoint=this.rolePoint(m,c)}
}
if(m.bombState==="dropped"){
let retriever=null,bd=1e9;
for(const c of engine.combatants){
if(c.isBot&&c.alive&&c.team===2){
const d=c.body.position.distanceTo(m.bombPos);
if(d<bd){bd=d;retriever=c}
}
}
for(const c of engine.combatants){
if(c.isBot&&c.alive&&c.team===2)c.objRole=(c===retriever)?"retrieve":(c.objRole==="retrieve"?"escort":c.objRole);
}
}
const c=m.carrier;
let planting=false;
if(c&&c.alive&&c.ctrl&&c.ctrl.plantE){
const s=this.siteAt(c.body.position);
if(s){
planting=true;
m.plantProg+=dt/this.plantTime;
UI.progShow("PLANTING THE BOMB \u00B7 SITE "+s.name,m.plantProg);
if(m.plantProg>=1){this.plantBomb(m,c,s);}
}
}
if(!planting){
if(m.plantProg>0){m.plantProg=Math.max(0,m.plantProg-dt*1.6);if(m.plantProg>0)UI.progShow("PLANTING",m.plantProg);else UI.progHide()}
}
}
if(m.bombState==="dropped"){
for(const c of engine.combatants){
if(!c.alive||c.team!==2||!c.bodyInWorld)continue;
if(c.body.position.distanceTo(m.bombPos)<1.4){
m.bombState="carried";m.carrier=c;c.hasBomb=true;
if(c.isBot){c.objRole="plant";c.objSite=m.sitePlan||"A";c.objPoint=this.rolePoint(m,c);}
this.bombHide(m);
UI.toast(c===engine.player?"YOU RECOVERED THE BOMB \u2014 PLANT AT A OR B":"BOMB RECOVERED BY "+c.name);
AUDIO.play("pk_ammo",{pos:m.bombPos});
break;
}
}
}
if(m.bombState==="planted"){
let defusing=false;
for(const c of engine.combatants){
if(!c.alive||c.team!==1||!c.ctrl||!c.ctrl.plantE)continue;
if(c.body.position.distanceTo(m.bombPos)<1.9){
defusing=true;
m.defuseProg+=dt/this.defuseTime;
UI.progShow(c===engine.player?"DEFUSING THE BOMB":c.name+" IS DEFUSING",m.defuseProg);
if(m.defuseProg>=1){this.bombDefused(m,c);return}
break;
}
}
if(!defusing){
if(m.defuseProg>0){m.defuseProg=Math.max(0,m.defuseProg-dt*2);if(m.defuseProg>0)UI.progShow("DEFUSING",m.defuseProg);else UI.progHide()}
}
}
let aCT=0,aT=0;
for(const c of engine.combatants){if(!c.alive)continue;if(c.team===1)aCT++;else if(c.team===2)aT++;}
if(aCT===0){this.endRound(m,"t2","COUNTER-TERRORISTS ELIMINATED");return}
if(aT===0&&m.bombState!=="planted"){this.endRound(m,"t1","TERRORISTS ELIMINATED");return}
},
onKill(m,k,v){
if(m.carrier===v&&m.bombState==="carried"&&v.body)this.dropBomb(m,v.body.position);
},
evaluate(m){
if(m.scores.t1>=this.roundsToWin)return"t1";
if(m.scores.t2>=this.roundsToWin)return"t2";
return null;},
scoreLine(m){return "CT "+m.scores.t1+" \u2014 "+m.scores.t2+" T \u00B7 ROUND "+Math.max(1,m.round)}}
};
