// Peer-to-peer friend play over WebRTC (PeerJS), host-authoritative.
// The host simulates everything; the guest sends input and renders snapshots.
import {CFG,GRP,SETTINGS,saveSettings,DIFFS,TEAM_HEX,TEAM_CSS,BOT_NAMES} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,UI,WPN,MATCH,BOTMAN,WORLD,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS,NADE_ORDER,standardLoadout} from '../game/weapons.js';

const $=id=>document.getElementById(id);

// NetPlayer is injected by net/netentities.js after both modules have
// evaluated -- importing it directly here would close a cycle through
// entities/combatant.js and leave BaseEntity in the temporal dead zone.
let NetPlayer=null;
export function _bindNetPlayer(cls){NetPlayer=cls}

export const NET2={
peer:null,conn:null,isHost:false,joined:false,connected:false,code:"",

// --- lobby ---------------------------------------------------------------
// The host owns this and mirrors it to the guest. Bot counts are explicit
// numbers the player sets, never derived from team size -- deriving them is
// what made "1v1 with a friend" spawn a bot on the enemy team as well.
lobby:{bots:{1:0,2:1},diff:"standard",hostTeam:1,started:false},
onLobby:null,

/** Humans on a team: the host, plus the guest when they are on that side. */
humansOn(team){
  let n=0;
  if(this.lobby.hostTeam===team)n++;
  if(this.connected&&this.guestTeam()===team)n++;
  return n;
},
guestTeam(){return this.lobby.hostTeam===1?2:1},
teamCount(team){return this.humansOn(team)+(this.lobby.bots[team]|0)},

setBots(team,n){
  if(!this.isHost&&this.connected)return;      // guests cannot edit the lobby
  const humans=this.humansOn(team);
  this.lobby.bots[team]=Math.max(0,Math.min(5-humans,n|0));
  this.pushLobby();
},
setHostTeam(t){
  if(!this.isHost&&this.connected)return;
  this.lobby.hostTeam=t;
  // Re-clamp both sides: moving a human can push a team over five.
  for(const k of[1,2])this.setBots(+k,this.lobby.bots[k]);
  this.pushLobby();
},
pushLobby(){
  if(this.isHost&&this.conn&&this.conn.open)this.conn.send({t:"lobby",l:this.lobby});
  if(this.onLobby)this.onLobby(this.lobby);
},
/** Bot composition to hand to BotManager at match start. */
composition(){
  return {1:this.lobby.bots[1]|0, 2:this.lobby.bots[2]|0};
},

inQ:null,lastSnap:null,uiQ:[],evQ:[],guestEnt:null,roster:[],youIdx:-1,meHp:null,meSlots:null,rtt:0,_snapT:0,_pingT:0,
status(t,ok){const el=$("net-status2");if(el){el.textContent=t;el.style.color=ok===false?"#ff8a94":ok===true?"#7fd8a0":"#7fa8b8"}},
peerOpts(){
const q=new URLSearchParams(location.search).get("peer");
if(q){const parts=q.split(":");return{host:parts[0],port:+parts[1]||443,path:parts[2]||"/myapp",debug:0}}
return{debug:0};
},
host(cb){
if(!window.Peer){this.status("PEERJS FAILED TO LOAD",false);return}
this.cleanup();this.isHost=true;
this.code=String(Math.floor(1000+Math.random()*9000));
this.status("CREATING ROOM\u2026");
this.peer=new Peer("nvx-d2-"+this.code,this.peerOpts());
this.peer.on("open",()=>{this.status("ROOM CODE: "+this.code+" \u2014 SHARE IT",true);cb&&cb(this.code)});
this.peer.on("error",e=>{this.status("P2P ERROR: "+e.type,false)});
this.peer.on("connection",c=>{
if(this.conn){c.close();return}
this.conn=c;this.connected=true;
c.on("open",()=>{
this.status("FRIEND CONNECTED \u2713",true);
AUDIO.play("beep");
if(engine&&engine.state==="playing")this.spawnGuest();
else this._pendingGuest=true;
});
this.wire(c);
});
},
join(code,cb){
if(!window.Peer){this.status("PEERJS FAILED TO LOAD",false);return}
this.cleanup();this.isHost=false;this.code=code;
this.status("JOINING "+code+"\u2026");
this.peer=new Peer(this.peerOpts());
this.peer.on("open",()=>{
this.conn=this.peer.connect("nvx-d2-"+code,{reliable:true});
this.conn.on("open",()=>{
this.connected=true;this.joined=true;
this.status("LINKED TO HOST \u2713",true);
this.conn.send({t:"hello",name:SETTINGS.name});
cb&&cb(true);
});
this.wire(this.conn);
});
this.peer.on("error",e=>{this.status("P2P ERROR: "+e.type,false);cb&&cb(false)});
setTimeout(()=>{if(!this.connected&&!this.joined){this.status("NO RESPONSE \u2014 CHECK CODE",false)}},8000);
},
wire(c){
c.on("data",d=>this.onData(d));
c.on("close",()=>{this.connected=false;
UI.toast(this.isHost?"FRIEND DISCONNECTED":"HOST DISCONNECTED");
if(this.isHost&&this.guestEnt){this.guestEnt.alive=false;this.guestEnt.stats.d++;}
});
c.on("error",()=>{this.connected=false});
},
onData(d){
switch(d.t){
case"hello":
  // A guest just attached; hand them the current lobby immediately.
  if(this.isHost){this.pushLobby();if(d.name)this.guestName=d.name}
  break;
case"lobby":
  this.lobby=d.l;
  if(this.onLobby)this.onLobby(this.lobby);
  break;
case"start":
  if(!this.isHost&&this.onStart)this.onStart();
  break;
case"init":this.joined=true;this.roster=d.roster;this.youIdx=d.youIdx;
SETTINGS.side=d.guestSide;saveSettings();
this.status("MATCH STARTING\u2026",true);
UI.showMenu(false);UI.loading(true,"JOINING HOST MATCH");
engine.startMatch(d.map,d.mode);
break;
case"s":this.lastSnap=d.s||d;break;
case"pong":this.rtt=Math.round(performance.now()-d.ts);break;
case"ping":if(this.conn&&this.conn.open)this.conn.send({t:"pong",ts:d.ts});break;
case"i":this.inQ=d.i;break;
case"vote":if(this.isHost&&UI._votes){UI._votes[d.m]=(UI._votes[d.m]||0)+1;UI.voteCounts(UI._votes)}break;
case"buy":if(this.isHost&&this.guestEnt)applyBuy(this.guestEnt,d.item);break;
case"nfx":this.onEv(d.e);break;
}
},
sendInit(){
if(!this.conn)return;
const roster=this.roster.map((r,i)=>({i,n:r.name,team:r.team,accent:r.accent}));
const youIdx=this.roster.findIndex(r=>r.guest);
this.conn.send({t:"init",map:MATCH.mapId,mode:MATCH.mode.id,guestSide:this.guestSide||"t",roster:roster,youIdx:Math.max(0,youIdx)});
},
sendInput(i){this._acc=(this._acc||0)+1;if(this.conn&&this.conn.open&&(this._acc%2===0))this.conn.send({t:"i",i})},
applyEnts(d){
if(!this.idxMap)return;
for(let i=0;i<d.e.length;i++){
if(i===this.youIdx)continue;
const px=this.idxMap[i];
if(px)px.setSnap(d.e[i]);
}
if(engine.player&&engine.player.puppet&&d.me){
engine.player.health=d.me[4];engine.player.armour=d.me[5]||0;
this.meHp=[d.me[4],d.me[5]||0];
}},
sendSnap(s){if(this.conn&&this.conn.open)this.conn.send({t:"s",s})},
sendEv(e){if(this.isHost){this.evQ.push(e)}else if(this.conn&&this.conn.open)this.conn.send({t:"ev",e})},
sendVote(m){if(this.conn&&this.conn.open)this.conn.send({t:"vote",m})},
sendStart(){if(this.isHost&&this.conn&&this.conn.open)this.conn.send({t:"start"})},
spawnGuest(){
if(!this.isHost)return;
const guestSide=MATCH.mode.teams?(engine.player.team===1?"t":"ct"):"t";
this.guestSide=guestSide;
const team=MATCH.mode.teams?(guestSide==="ct"?1:2):0;
const ent=new NetPlayer(SETTINGS.name==="PILOT"?"GUEST":SETTINGS.name,team);
this.guestEnt=ent;
engine.add(ent);
engine.combatants.push(ent);
this.roster=engine.combatants.map(c=>({name:c.name,team:c.team,accent:c.accent,guest:c===ent}));
MATCH.spawnEntity(ent);
this.sendInit();
UI.announce("FRIEND JOINED",ent.name+" \u2192 "+(team===1?"COUNTER-TERRORISTS":team===2?"TERRORISTS":"FREE-FOR-ALL"));
},
buildSnap(){
const cts=engine.combatants;
const me=this.guestEnt;
const meOut=me?[+me.body.position.x.toFixed(2),+me.body.position.y.toFixed(2),+me.body.position.z.toFixed(2),me.groundedInfo&&me.groundedInfo.grounded?1:0,Math.round(me.health),Math.round(me.armour),me.curSlot,me.slots.map(x=>[x.mag,x.reserve]),Math.round(me.money||0),me.nades?me.nades.he:0,me.nades?me.nades.flash:0,me.nades?me.nades.smoke:0,me.nades?me.nades.molotov:0]:null;
return{ph:MATCH.phase,tl:+MATCH.timeLeft.toFixed(1),s1:Math.floor(MATCH.scores.t1||0),s2:Math.floor(MATCH.scores.t2||0),
round:MATCH.mode.roundBased?MATCH.mode.round:0,
bst:MATCH.mode.roundBased?MATCH.mode.bombState:"",bsite:MATCH.mode.siteName||"",
bx:MATCH.mode.bombPos?+MATCH.mode.bombPos.x.toFixed(2):0,by:MATCH.mode.bombPos?+MATCH.mode.bombPos.y.toFixed(2):0,bz:MATCH.mode.bombPos?+MATCH.mode.bombPos.z.toFixed(2):0,
e:cts.map((c,i)=>[+c.body.position.x.toFixed(2),+c.body.position.y.toFixed(2),+c.body.position.z.toFixed(2),+c.yaw.toFixed(2),Math.round(c.health),c.alive?1:0,c.stats.k,c.stats.d,Math.round(c.stats.dmg)]),
me:meOut,ui:this.uiQ,ev:this.evQ};
},
applySnap(d){
this.lastSnap=d;
if(Array.isArray(d.ui))for(const u of d.ui)this.onUi(u);
if(Array.isArray(d.ev))for(const e of d.ev)this.onEv(e);
this.uiQ=[];this.evQ=[];
},
onUi(u){
switch(u.e){
case"ann":UI.announce(u.m,u.s||"");break;
case"feed":UI.feedRaw(u.html,u.me);break;
case"obj":UI.objShow(u.t,u.b);break;
case"prog":UI.progShow(u.l,u.f);break;
case"progh":UI.progHide();break;
case"toast":UI.toast(u.t);break;
case"hm":break;
case"end":UI.endRemote(u);break;
case"et":UI.endTimer(u.s);break;
case"rr":MATCH.remoteReset(u);break;
case"vig":UI.vigFlash();break;
}
},
onEv(e){
switch(e.e){
case"shot":AUDIO.play(e.snd,{pos:_va.set(e.x,e.y,e.z),vol:.7});FX.tracer(_va.set(e.x,e.y,e.z),_vb.set(e.x2,e.y2,e.z2),e.c);FX.flash(_va.set(e.x,e.y,e.z),e.c,.8);break;
case"exp":
_va.set(e.x,e.y,e.z);
FX.explosion(_va,e.r,e.c);
AUDIO.play("explosion",{pos:_va,vol:.9});
GFX.addTrauma(.35);
break;
case"dmg":if(engine.player&&engine.player.puppet){engine.player.takeDamage(e.d,null,{net:true,point:_va.set(e.x,e.y,e.z),fromPos:_vb.set(e.fx,e.fy,e.fz)});}break;
case"resp":if(engine.player&&engine.player.puppet)engine.player.remoteRespawn(e);break;
case"hit":UI.hitmark(e.k,e.h);AUDIO.play(e.h?"hit_head":"hit");break;
case"nfx":{
const p=_va.set(e.x,e.y,e.z);
if(e.t==="he"){FX.explosion(p,8,0xffc266);AUDIO.play("heboom",{pos:p})}
else if(e.t==="flash"){FX.flashPop(p);AUDIO.play("flashpop",{pos:p,vol:.9});
if(engine.player&&engine.player.alive){const eye=engine.player.eyePos(_va);const d=eye.distanceTo(p);
if(d<26&&PHYS.losClear(eye,p,null)){
_vd.subVectors(p,eye).normalize();
_vc.set(0,0,-1).applyQuaternion(GFX.camera.quaternion);
const f=_vc.dot(_vd)*.5+.5;
UI.flashBlind(U.clamp((2.8*f+.4)*(1-d/34),0,3));
}}}
else if(e.t==="smoke"){if(!WORLD.smokes)WORLD.smokes=[];WORLD.smokes.push({p:p.clone(),r:3.4,t:15});FX.smokeBloom(p);AUDIO.play("smokehiss",{pos:p})}
else if(e.t==="molotov"){if(!WORLD.fires)WORLD.fires=[];WORLD.fires.push({p:p.clone().setY(p.y+.05),r:3.1,t:7,sn:0});FX.fireStart(p);AUDIO.play("fireignite",{pos:p})}
break;}
}
},
cleanup(){
if(this.peer){try{this.peer.destroy()}catch(e){}}
this.peer=null;this.conn=null;this.connected=false;this.joined=false;this.isHost=false;
this.guestEnt=null;this.roster=[];this.uiQ=[];this.evQ=[];this.lastSnap=null;
}
};