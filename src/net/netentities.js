// Networked entity wrappers. Split out of p2p.js so that module can stay free
// of entity imports -- see the note on _bindNetPlayer there.
import {CFG,GRP,SETTINGS,DIFFS,TEAM_HEX,TEAM_CSS,BOT_NAMES} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,UI,WPN,MATCH,BOTMAN,WORLD,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS,NADE_ORDER,standardLoadout} from '../game/weapons.js';
import {BaseEntity,Combatant} from '../entities/combatant.js';
import {Bot} from '../entities/bot.js';
import {buildCharMesh} from '../entities/charmesh.js';
import {NET2,_bindNetPlayer} from './p2p.js';

const $=id=>document.getElementById(id);

export class NetProxy extends BaseEntity{
constructor(d){
super("proxy");
this.name=d.n;this.team=d.team;this.accent=d.accent;this.isBot=false;this.remote=true;
this.stats={k:0,d:0,dmg:0,ping:0};this.score=0;this.alive=true;this.hp=100;this.hasBomb=false;
this.body={position:new THREE.Vector3(),velocity:new THREE.Vector3()};this.bodyInWorld=true;
this.tp=new THREE.Vector3();this.tyaw=0;
this.visual=buildCharMesh(d.accent,d.n,true);
}
setSnap(a){
this.tp.set(a[0],a[1],a[2]);this.tyaw=a[3];this.hp=a[4];
const was=this.alive;this.alive=!!a[5];
this.stats.k=a[6];this.stats.d=a[7];this.stats.dmg=a[8];
if(was&&!this.alive)this.visual.die(_va.set(U.rand(-1,1),0,U.rand(-1,1)).clone());
if(!was&&this.alive)this.visual.reset();
this.visual.drawName(Math.max(0,this.hp));
}
reset(){this.alive=true;this.hp=100;this.visual.reset();this.stats.k=0;this.stats.d=0;this.stats.dmg=0;this.score=0}
update(dt){
const r=this.visual.root;
const px=r.position.x,pz=r.position.z;
r.position.x=U.damp(r.position.x,this.tp.x,14,dt);
r.position.y=U.damp(r.position.y,this.tp.y,14,dt);
r.position.z=U.damp(r.position.z,this.tp.z,14,dt);
this.body.position.set(r.position.x,r.position.y-CFG.feetOff,r.position.z);
r.rotation.y=U.angLerp(r.rotation.y,this.tyaw,U.clamp(dt*10,0,1));
const spd=Math.hypot(r.position.x-px,r.position.z-pz)/Math.max(.001,dt);
this.visual.anim(dt,spd,this.alive,0);
}
destroy(){GFX.scene.remove(this.visual.root)}
}
export class NetPlayer extends Bot{
constructor(name,team){
super(name,SETTINGS.diff,team,team?TEAM_HEX[team]:0x9dff5a);
this.remote=true;this.isBot=false;
}
update(dt){
if(!this.alive){if(this.body)this.syncVisual(dt,true);return}
const i=NET2.inQ;
this.ctrl.mx=0;this.ctrl.mz=0;this.ctrl.jump=false;this.ctrl.plantE=false;this.ctrl.fire=false;
if(i){
this.ctrl.mx=U.clamp(i.mx||0,-1,1);this.ctrl.mz=U.clamp(i.mz||0,-1,1);
this.ctrl.sprint=!!i.sp;this.ctrl.crouch=!!i.cr;this.ctrl.plantE=!!i.pe;
if(i.jmp){this.ctrl.jump=true;this.ctrl.jumpConsume=true}
this.yaw=i.yaw||0;this.pitch=U.clamp(i.pit||0,-1.55,1.55);
this.adsAmt=U.damp(this.adsAmt||0,i.ads?1:0,14,dt);
if(i.w!==undefined&&i.w!==this.curSlot&&i.w>=0&&i.w<this.slots.length){this.curSlot=i.w;this.pendingSlot=-1;this.switchAnim=0;this.slotsDirty=true}
if(i.rel)this.startReload();
if(i.fr){this.ctrl.fire=true;NET2._attempts=(NET2._attempts||0)+1}
if(i.nd&&!this._ndSent){this._ndSent=true;
const dir=WPN.aimDir(this,new THREE.Vector3());
WPN.throwNade(this,i.nd,dir,16);
}else if(!i.nd)this._ndSent=false;
}
this.applyMove(dt);
this.ctrl.jump=false;
const st=this.slotState(),cfg=this.currentCfg();
st.cd-=dt;
st.bloom=Math.max(0,st.bloom-cfg.bloomDecay*dt);
if(st.reloading>0){st.reloading-=dt;if(st.reloading<=0){const need=cfg.mag-st.mag,take=Math.min(need,st.reserve);st.mag+=take;st.reserve-=take}}
if(this.ctrl.fire){
this.ctrl.fire=false;
if(st.cd<=0&&st.reloading<=0&&st.mag>0&&WPN.fire(this,i&&i.ch?i.ch:1)){
NET2._fires=(NET2._fires||0)+1;
const eye=this.eyePos(new THREE.Vector3());
const dir=WPN.aimDir(this,new THREE.Vector3());
const res=PHYS.combatRay(eye,dir,cfg.range,this,false);
const end=res.chars.length?res.chars[0].point:res.wall?res.wall.point:eye.clone().addScaledVector(dir,cfg.range);
NET2.sendEv({e:"shot",x:+eye.x.toFixed(2),y:+eye.y.toFixed(2),z:+eye.z.toFixed(2),x2:+end.x.toFixed(2),y2:+end.y.toFixed(2),z2:+end.z.toFixed(2),c:cfg.tracerColor,snd:cfg.snd});
if(res.chars.length)NET2.sendEv({e:"hit",k:!res.chars[0].ud.alive,h:res.chars[0].part==="head"});
}
}
if(st.mag<=0&&st.reloading<=0&&st.reserve>0)st.reloading=cfg.reload;
this.syncVisual(dt,false);
}
}
export class NetworkManager{
constructor(){this.online=false;this.sock=null;this.myId=null;this.snapBuf=[];this._acc=0;this.remotes=new Map()}connect(){
return new Promise(resolve=>{
let settled=false;
const done=v=>{if(!settled){settled=true;resolve(v)}};
if(!window.io){done(false);return}
try{
this.sock=io(SETTINGS.server,{reconnectionAttempts:1,timeout:2000,multiplex:false,forceNew:true});
const to=setTimeout(()=>{this.cleanup();UI.netStatus("OFFLINE SIM",false);done(false)},2000);
this.sock.on("connect",()=>{
clearTimeout(to);this.online=true;
UI.netStatus("LINKED",true);
done(true);
});
this.sock.on("connect_error",()=>{clearTimeout(to);this.cleanup();UI.netStatus("OFFLINE SIM",false);done(false)});
this.sock.on("welcome",d=>{this.myId=d.id});
this.sock.on("snapshot",d=>this.onSnapshot(d));
}catch(e){done(false)}
});
}
cleanup(){
if(this.sock){try{this.sock.disconnect()}catch(e){}}
this.online=false;this.sock=null;
}
sendSample(p){
if(!this.online||!this.sock)return;
this._acc+=engine.dt;
if(this._acc<.05)return;
this._acc=0;
this.sock.emit("input",{seq:engine.frame,yaw:p.yaw,pitch:p.pitch,
mx:p.ctrl.mx,mz:p.ctrl.mz,jump:p.ctrl.jump?1:0,
x:p.body.position.x,y:p.body.position.y,z:p.body.position.z});
}
onSnapshot(data){
this.snapBuf.push(data);
while(this.snapBuf.length>30)this.snapBuf.shift();
for(const e of data.ents){
if(e.id===this.myId)continue;
let r=this.remotes.get(e.id);
if(!r){
r=new RemoteAvatar(e);
this.remotes.set(e.id,r);
}
r.pushSnap(data.t,e);
}
}
update(dt){
if(this.online)for(const[id,r]of this.remotes)r.update(dt);
}
spawnBotsForMatch(comp){
BOTMAN.spawnBots(comp);
}
dispose(){
this.cleanup();
for(const[id,r]of this.remotes)r.dispose();
this.remotes.clear();this.snapBuf.length=0;
}
}
export class RemoteAvatar{
constructor(e){
this.vis=buildCharMesh(e.color||0xffffff,e.name||"NET",true);
this.snaps=[];
}
pushSnap(t,e){
this.snaps.push({t,p:new THREE.Vector3(e.x,e.y,e.z),yaw:e.yaw,hp:e.hp});
while(this.snaps.length>20)this.snaps.shift();
}
update(dt){
if(this.snaps.length<2)return;
const renderT=engine.time-.1;
let a=this.snaps[0],b=this.snaps[this.snaps.length-1];
for(let i=0;i<this.snaps.length-1;i++){
if(this.snaps[i].t<=renderT&&this.snaps[i+1].t>=renderT){a=this.snaps[i];b=this.snaps[i+1];break}
}
const span=Math.max(.001,b.t-a.t);
const t=U.clamp((renderT-a.t)/span,0,1);
this.vis.root.position.lerpVectors(a.p,b.p,t);
this.vis.root.rotation.y=U.angLerp(a.yaw,b.yaw,t);
this.vis.anim(dt,3,true,false);
this.vis.drawName(b.hp);
}
dispose(){
GFX.scene.remove(this.vis.root);
}
}

_bindNetPlayer(NetPlayer);
