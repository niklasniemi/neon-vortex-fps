// HUD, scoreboard, killfeed, crosshair and end-of-match screen.
// Menu navigation lives in ui/menu.js; the buy grid in ui/buymenu.js.
import {CFG,SETTINGS,saveSettings,DIFFS,TEAM_HEX,TEAM_CSS,TEAM_NAME,BOT_NAMES} from '../core/config.js';
import {U,_va,_vb,_vc,_vd} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,INPUT,MATCH,WORLD,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS,NADE_ORDER} from '../game/weapons.js';
import {MODES} from '../game/modes.js';
import {ARENAS} from '../world/maps.js';
import {NET2} from '../net/p2p.js';
import {Menu} from './menu.js';
import {BuyMenu} from './buymenu.js';

const $=id=>document.getElementById(id);

export class UIManager{
constructor(){
this.el={};
for(const id of["coordchip", "buywrap", "buygrid", "buymoney", "buytimer", "moneyhud", "nadebar", "flashfx", "xhair", "vig", "hud", "menu", "pause", "end", "loading", "loadtxt", "feed", "annmain", "annsub", "hpfill", "hpnum", "arfill", "arnum", "magnum", "resnum", "wname", "slots", "miniscores", "timerchip", "radar", "boardwrap", "board", "standings", "toast", "netchip", "netdot", "nettxt", "fpschip", "scope", "dmglayer", "endtitle", "endsub", "endtimer", "hitm", "objbar", "progwrap", "proglab", "progfill", "respawnmsg", "btn-resume", "btn-quit", "armicon", "helmicon", "defusericon", "buyhint"])this.el[id]=$(id);
this.ctx=this.el.xhair.getContext("2d");
this.rctx=this.el.radar.getContext("2d");
this.slotsDirty=true;
this.boardOpen=false;this.boardTimer=0;
this.hurtLevel=0;this._hurtDecay=0;
this.fpsAcc=0;this.fpsN=0;this.fpsT=0;
this.sel={mode:"defuse",map:"pvp_dust2"};
this.toastTimer=null;
this.buildSlots();
this.bindMenu();
this.bindPause();
}
buildSlots(){this.refreshSlots(5)}
refreshSlots(n){
this.el.slots.innerHTML="";
for(let i=0;i<n;i++){
const d=document.createElement("div");
d.className="slot";d.textContent=i+1;
this.el.slots.appendChild(d);
}
this.slotsDirty=true;
}
progShow(label,f){
this.el.progwrap.classList.remove("hidden");
this.el.proglab.textContent=label;
this.el.progfill.style.transform="scaleX("+U.clamp(f,0,1)+")";
}
progHide(){this.el.progwrap.classList.add("hidden")}
objShow(t,blink){
if(!t){this.el.objbar.classList.add("hidden");return}
this.el.objbar.classList.remove("hidden");
this.el.objbar.textContent=t;
this.el.objbar.classList.toggle("blink",!!blink);
}
respawnShow(t){
if(!t){this.el.respawnmsg.classList.add("hidden");return}
this.el.respawnmsg.textContent=t;
this.el.respawnmsg.classList.remove("hidden");
}
respawnHide(){this.el.respawnmsg.classList.add("hidden")}
flashBlind(dur){
const f=this.el.flashfx;
f.style.transition="opacity .04s";
f.style.opacity="1";
setTimeout(()=>{f.style.transition="opacity "+dur.toFixed(2)+"s ease-in";f.style.opacity="0"},50);
AUDIO.tone(1150,Math.min(1.4,dur),"sine",.14);
}
nadeBar(p){
const el=this.el.nadebar;
el.innerHTML="";
if(!p||!MATCH.mode.roundBased)return;
NADE_ORDER.forEach(t=>{
if(p.nades[t]<=0)return;
const d=document.createElement("div");
d.className="nd"+(p.nadeMode&&NADE_ORDER[p.nadeSel%NADE_ORDER.length]===t?" on":"");
const nd=NADE_DEFS[t];
const label=(p.team===1&&nd.ctId)?"INC":(nd.short||nd.name.split(" ")[0]);
d.innerHTML=label+" <small>\u00D7"+p.nades[t]+"</small>";
el.appendChild(d);
});
}
moneyHud(p){this.el.moneyhud.textContent="$ "+Math.floor(p?p.money:0)}
syncLabels(){
this.el.sensval.textContent=SETTINGS.sens.toFixed(2);
this.el.adssensval&& (this.el.adssensval.textContent=SETTINGS.adsSens.toFixed(2));
this.el.fovval.textContent=SETTINGS.fov;
this.el.volval.textContent=Math.round(SETTINGS.vol*100)+"%";
this.el.shakeval&& (this.el.shakeval.textContent=Math.round(SETTINGS.shake*100)+"%");
this.el.bobval&& (this.el.bobval.textContent=Math.round(SETTINGS.bob*100)+"%");
this.el.bloomval&& (this.el.bloomval.textContent=Math.round(SETTINGS.bloomAmt*100)+"%");
this.el.xsizeval&& (this.el.xsizeval.textContent=Math.round(SETTINGS.crossSize*100)+"%");
}
buyOpen=false;
toggleBuy(force){BuyMenu.toggle(force)}
bindMenu(){Menu.init()}
bindPause(){
this.el["btn-resume"].onclick=()=>{AUDIO.play("ui_click",{ui:true});engine.pause(false)};
this.el["btn-quit"].onclick=()=>{AUDIO.play("ui_click",{ui:true});engine.quitToMenu()};
}
showMenu(b){this.el.menu.classList.toggle("hidden",!b);if(b&&Menu.bg)Menu.bg.start();else if(Menu.bg)Menu.bg.stop()}
showHUD(b){this.el.hud.classList.toggle("hidden",!b);this.el.xhair.classList.toggle("hidden",!b)}
pauseShow(b){this.el.pause.classList.toggle("hidden",!b)}
loading(b,txt){this.el.loading.classList.toggle("hidden",!b);if(txt)this.el.loadtxt.textContent=txt}
loadtxt(t){this.loading(true,t)}
scope(b){this.el.scope.classList.toggle("hidden",!b)}
netStatus(txt,ok){this.el.nettxt.textContent=txt;this.el.netdot.classList.toggle("bad",!ok)}
toast(t){
this.el.toast.textContent=t;
this.el.toast.classList.remove("hidden");
clearTimeout(this.toastTimer);
this.toastTimer=setTimeout(()=>this.el.toast.classList.add("hidden"),2200);
}
announce(main,sub){
const a=this.el.annmain,s=this.el.annsub;
a.textContent=main;s.textContent=sub||"";
a.classList.remove("show");s.classList.remove("show");
void a.offsetWidth;
a.classList.add("show");s.classList.add("show");
}
feed(k,v,label,head,extra){
const d=document.createElement("div");
d.className="feeditem"+(k===engine.player||v===engine.player?" me":"");
let html="";
if(extra&&!k&&!v)html="<b style='color:#ff9ae8'>"+extra+"</b> <span class='fw'>"+label+"</span>";
else if(!k)html="<span class='fw'>"+label+"</span> <b>"+this.nameOf(v)+"</b>";
else html="<b>"+this.nameOf(k)+"</b> <span class='fw'>\u27E1 "+label+(head?" \u2605":"")+" \u27E1</span> <b>"+this.nameOf(v)+"</b>";
this.feedRaw(html,k===engine.player||v===engine.player);
}
feedRaw(html,me){
const d=document.createElement("div");
d.className="feeditem"+(me?" me":"");
d.innerHTML=html;
this.el.feed.prepend(d);
while(this.el.feed.children.length>6)this.el.feed.lastChild.remove();
setTimeout(()=>{d.style.opacity="0";d.style.transition="opacity .6s"},4200);
setTimeout(()=>d.remove(),5000);
}
nameOf(c){
if(!c)return"ARENA";
if(c.isEnv)return c.name;
const col=c.team?TEAM_CSS[c.team]:"#9fdcef";
return"<span style='color:"+col+"'>"+c.name+"</span>";
}
hitmark(kill,head){
const h=this.el.hitm;
h.classList.remove("pop","kill");
void h.offsetWidth;
if(kill)h.classList.add("kill");
h.classList.add("pop");
}
vigFlash(){
this.el.vig.classList.add("hurt");
clearTimeout(this._vt);
this._vt=setTimeout(()=>this.el.vig.classList.remove("hurt"),180);
this.hurtLevel=Math.max(this.hurtLevel,.55);
}
critVig(on){this.el.vig.classList.toggle("crit",on)}
damageFrom(srcPos){
const p=engine.player;if(!p)return;
let ang;
if(srcPos){
_vd.subVectors(srcPos,p.body.position);
const wy=Math.atan2(-_vd.x,-_vd.z);
ang=(wy-p.yaw)*180/Math.PI;
}else ang=U.rand(0,360);
const d=document.createElement("div");
d.className="dmgarc";
d.style.transform="rotate("+ang+"deg)";
this.el.dmglayer.appendChild(d);
requestAnimationFrame(()=>d.style.opacity="0");
setTimeout(()=>d.remove(),650);
}
powShow(b){}
powTime(n){}
cpWidget(st){}
scoreboard(show){
this.boardOpen=show;
this.el.boardwrap.classList.toggle("hidden",!show);
if(show)this.refreshBoard(true);
}
refreshBoard(force){
if(!force&&this.boardTimer>0)return;
this.boardTimer=.5;
const m=MATCH,rows=[...engine.combatants].sort((a,b)=>((b.stats.k*100+(b.score||0))-(a.stats.k*100+(a.score||0)))||b.stats.dmg-a.stats.dmg);
let html="<caption>"+m.mode.label.toUpperCase()+" \u00B7 "+WORLD.def.label+"</caption>";
html+="<tr><th>PILOT</th><th>K</th><th>D</th><th>DMG</th><th>PING</th><th>SCORE</th></tr>";
if(m.mode.teams){
const t1=rows.filter(r=>r.team===1),t2=rows.filter(r=>r.team===2);
html+=this.teamTable(t1,1)+this.teamTable(t2,2);
}else{
for(const r of rows)html+=this.rowHtml(r,null);
}
this.el.board.innerHTML=html;
}
teamTable(rows,t){
const tname=t===1?(MATCH.mode.id==="defuse"?"COUNTER-TERRORISTS":"CYAN SQUAD"):(MATCH.mode.id==="defuse"?"TERRORISTS":"ORANGE SQUAD");
let h="<tr><th colspan='6'><span class='tchip' style='background:"+TEAM_CSS[t]+"'></span>"+tname+" \u2014 "+(MATCH.scores["t"+t]||0)+"</th></tr>";
for(const r of rows)h+=this.rowHtml(r,t);
return h;
}
rowHtml(r,team){
const you=r===engine.player?" class='you'":"";
return"<tr"+you+"><td><span class='tchip' style='background:#"+r.accent.toString(16).padStart(6,"0")+"'></span>"+r.name+(r.isBot?"":" \u25C6")+"</td><td class='k'>"+r.stats.k+"</td><td>"+r.stats.d+"</td><td>"+Math.round(r.stats.dmg)+"</td><td>"+r.stats.ping+"</td><td>"+(r.score||0)+"</td></tr>";
}
endScreen(data,onVote){
this.el.end.classList.remove("hidden");
const meWin=data.type==="player"?data.ent===engine.player:(data.type==="team"?data.id==="t"+engine.player.team:false);
this.el.endtitle.textContent=data.draw?"STALEMATE":meWin?"VICTORY":"DEFEAT";
this.el.endtitle.classList.toggle("lost",!meWin&&!data.draw);
this.el.endsub.textContent=data.sub||"";
let rows=[...engine.combatants].sort((a,b)=>(b.stats.k-a.stats.k)||b.stats.dmg-a.stats.dmg);
let html="<tr><th>#</th><th>PILOT</th><th>K</th><th>D</th><th>DMG</th></tr>";
rows.slice(0,10).forEach((r,i)=>{
html+="<tr"+(r===engine.player?" class='you'":"")+"><td>"+(i+1)+"</td><td>"+r.name+(i===0?" \u2605 MVP":"")+"</td><td>"+r.stats.k+"</td><td>"+r.stats.d+"</td><td>"+Math.round(r.stats.dmg)+"</td></tr>";
});
this.el.standings.innerHTML=html;
this._myVote=null;
this._onVote=onVote;
}
voteCounts(v){}
endTimer(s){
this.el.endtimer.textContent=s>0?"NEXT DEPLOYMENT IN "+s+"s":"DEPLOYING\u2026";
if(NET2.isHost)NET2.sendEv({e:"et",s});
}
endRemote(u){
this.el.end.classList.remove("hidden");
this.el.endtitle.textContent=u.title;
this.el.endtitle.classList.toggle("lost",!!u.lost);
this.el.endsub.textContent=u.sub||"";
let html="<tr><th>#</th><th>PILOT</th><th>K</th><th>D</th><th>DMG</th></tr>";
u.rows.forEach((r,i)=>{
html+="<tr"+(r[4]?" class='you'":"")+"><td>"+(i+1)+"</td><td>"+r[0]+(i===0?" \u2605 MVP":"")+"</td><td>"+r[1]+"</td><td>"+r[2]+"</td><td>"+r[3]+"</td></tr>";
});
this.el.standings.innerHTML=html;
}
hideEnd(){this.el.end.classList.add("hidden")}
drawCrosshair(){
const g=this.ctx,p=engine.player;
g.clearRect(0,0,96,96);
if(!p||!p.alive||this.boardOpen)return;
const st=p.slotState(),cfg=p.currentCfg();
if(p.adsAmt>.85&&cfg.scope)return;
const mv=Math.sqrt(p.body.velocity.x**2+p.body.velocity.z**2);
const grounded=p.groundedInfo&&p.groundedInfo.grounded;
let mult=1+U.clamp(mv/CFG.walk,0,1)*2.6;
if(!grounded)mult*=3.4;
if(p.crouchAmt>.5)mult*=.62;
const spreadPx=(cfg.spread+st.bloom)*U.lerp(1,cfg.adsSpreadMult,p.adsAmt)*mult*760;
const gap=(7+spreadPx)*SETTINGS.crossSize,len=8*SETTINGS.crossSize;
g.strokeStyle=SETTINGS.crossColor;g.lineWidth=2;
g.shadowColor=SETTINGS.crossColor;g.shadowBlur=4;
for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
g.beginPath();
g.moveTo(48+dx*gap,48+dy*gap);
g.lineTo(48+dx*(gap+len),48+dy*(gap+len));
g.stroke();
}
g.fillStyle=SETTINGS.crossColor;
if(SETTINGS.crossDot)g.fillRect(46.5,46.5,3,3);
g.shadowBlur=0;
if(false){
g.strokeStyle="#ff7a4d";g.lineWidth=3;
g.beginPath();g.arc(48,48,20,-Math.PI/2,-Math.PI/2+p.chargeT*Math.PI*2);g.stroke();
}
if(st.reloading>0){
const pr=1-st.reloading/cfg.reload;
g.strokeStyle="rgba(255,214,77,.9)";g.lineWidth=3;
g.beginPath();g.arc(48,48,26,-Math.PI/2,-Math.PI/2+pr*Math.PI*2);g.stroke();
}
}
drawRadar(){
const g=this.rctx,S=176,c=S/2;
g.clearRect(0,0,S,S);
const p=engine.player;if(!p||!WORLD||!WORLD.def)return;
const range=42;
const sc=c/range;
g.save();
g.beginPath();g.arc(c,c,c-2,0,7);g.clip();
g.fillStyle="rgba(8,20,30,.55)";
g.fillRect(0,0,S,S);
g.strokeStyle="rgba(79,227,255,.18)";
for(let r=14;r<c;r+=14){g.beginPath();g.arc(c,c,r,0,7);g.stroke()}
g.beginPath();g.moveTo(c,0);g.lineTo(c,S);g.moveTo(0,c);g.lineTo(S,c);g.stroke();
const cy=SETTINGS.mmRotate?Math.cos(p.yaw):1,sy=SETTINGS.mmRotate?Math.sin(p.yaw):0;
const proj=(wx,wz)=>{
const dx=wx-p.body.position.x,dz=wz-p.body.position.z;
return[c+(dx*cy+dz*sy)*sc,c+(dx*sy+dz*cy)*sc];
};
g.fillStyle="rgba(79,227,255,.14)";
for(const r of WORLD.mmRects){
const pts=[[r.x-r.w/2,r.z-r.d/2],[r.x+r.w/2,r.z-r.d/2],[r.x+r.w/2,r.z+r.d/2],[r.x-r.w/2,r.z+r.d/2]];
g.beginPath();
pts.forEach(([wx,wz],i)=>{const[x,y]=proj(wx,wz);i?g.lineTo(x,y):g.moveTo(x,y)});
g.closePath();g.fill();
}
if(WORLD.cpDef){
const[x,y]=proj(WORLD.cpDef.p.x,WORLD.cpDef.p.z);
g.strokeStyle=MATCH.cpOwner===1?"#4fe3ff":MATCH.cpOwner===2?"#ffc24d":"rgba(200,220,240,.7)";
g.lineWidth=2;
g.beginPath();g.arc(x,y,5,0,7);g.stroke();
}
for(const pk of engine.entities){
if(pk.type==="pickup"&&pk.active){
const[x,y]=proj(pk.p.x,pk.p.z);
g.fillStyle=pk.kind==="health"?"#37ff8f":pk.kind==="ammo"?"#ffe14d":"#ff7ae0";
g.fillRect(x-1.5,y-1.5,3,3);
}
}
if(MATCH.mode.id==="defuse"&&WORLD.def.sites){
g.font="800 11px Segoe UI,Arial";g.textAlign="center";g.textBaseline="middle";
for(const st of WORLD.def.sites){
const[sx2,sy2]=proj(st.x,st.z);
g.fillStyle="rgba(255,210,77,.95)";
g.fillText(st.name,sx2,sy2);
}
const bmd=MATCH.mode;
if((bmd.bombState==="planted"||bmd.bombState==="dropped")&&bmd.bombPos){
const[bx,by]=proj(bmd.bombPos.x,bmd.bombPos.z);
if(bmd.bombState==="planted"){
g.fillStyle=Math.sin(engine.time*10)>0?"#ff2434":"#6e0f1c";
g.beginPath();g.arc(bx,by,4.5,0,7);g.fill();
}else{g.fillStyle="#ffe14d";g.fillRect(bx-3,by-3,6,6)}
}
}
for(const e of engine.combatants){
if(!e.alive||e===p||!e.bodyInWorld)continue;
const dx=e.body.position.x-p.body.position.x,dz=e.body.position.z-p.body.position.z;
if(dx*dx+dz*dz>range*range)continue;
const[x,y]=proj(e.body.position.x,e.body.position.z);
const mate=MATCH.mode.teams&&e.team===p.team;
g.fillStyle=mate?"#4fe3ff":"#ff4d5e";
g.beginPath();g.arc(x,y,3,0,7);g.fill();
if(e===MATCH.lastShooter&&engine.time-MATCH.lastShotT<.5&&!mate){
g.strokeStyle="rgba(255,77,94,.8)";
g.beginPath();g.arc(x,y,6+(engine.time-MATCH.lastShotT)*22,0,7);g.stroke();
}
}
g.restore();
g.save();g.translate(c,c);
if(!SETTINGS.mmRotate)g.rotate(-p.yaw);
g.fillStyle="#fff";
g.beginPath();g.moveTo(0,-6);g.lineTo(-4,4);g.lineTo(4,4);g.closePath();g.fill();
g.restore();
g.strokeStyle="rgba(79,227,255,.5)";g.lineWidth=2;
g.beginPath();g.arc(c,c,c-2,0,7);g.stroke();
}
update(dt){
this.boardTimer-=dt;
const p=engine.player;
this.hurtLevel=Math.max(0,this.hurtLevel-dt*1.5);
if(p){
const hpF=U.clamp(p.health/p.maxHealth,0,1);
this.el.hpfill.style.transform="scaleX("+hpF+")";
this.el.hpfill.style.background=hpF>.5?"linear-gradient(90deg,#37d97f,#5dff8f)":hpF>.25?"linear-gradient(90deg,#d9a237,#ffd24d)":"linear-gradient(90deg,#c92f3f,#ff4d5e)";
this.el.arfill.style.transform="scaleX("+U.clamp(p.armour/p.maxArmour,0,1)+")";
this.el.hpnum.textContent=Math.max(0,Math.ceil(p.health));
this.el.arnum.textContent=Math.ceil(p.armour);
if(this.el.armicon)this.el.armicon.classList.toggle("off",p.armour<=0);
if(this.el.helmicon)this.el.helmicon.classList.toggle("off",!p.helmet);
if(this.el.defusericon)this.el.defusericon.classList.toggle("off",!p.hasDefuser);
const st=p.slotState(),cfg=p.currentCfg();
this.el.magnum.textContent=st.reloading>0?"--":st.mag;
this.el.resnum.textContent="/"+st.reserve;
this.el.wname.textContent=cfg.name;
if(this.slotsDirty){
this.slotsDirty=false;
[...this.el.slots.children].forEach((d,i)=>{
d.classList.toggle("on",i===p.curSlot);
d.classList.toggle("dry",p.slots[i].mag<=0&&p.slots[i].reserve<=0);
});
}
this.el.timerchip.textContent=U.fmt(MATCH.timeLeft);
this.el.timerchip.classList.toggle("low",MATCH.timeLeft<31&&MATCH.phase==="live"&&!MATCH.mode.roundBased);
this.el.miniscores.textContent=MATCH.mode.scoreLine(MATCH)||(MATCH.sudden?"SUDDEN DEATH":"");
if(p&&!p.alive){
if(MATCH.mode.roundBased){
this.respawnShow(MATCH.mode.roundPhase==="post"?"ROUND OVER":"ELIMINATED \u2014 SPECTATING \u00B7 NEXT ROUND SOON");
}else{
const q=MATCH.respawnQ.find(r=>r.ent===p);
this.respawnShow(q?"REDEPLOYING IN "+Math.ceil(q.t)+"s":"");
}
}else this.respawnHide();
this.moneyHud(p);
this.nadeBar(p);
this.drawCrosshair();
this.drawRadar();
if(this.boardOpen)this.refreshBoard();
}
this.fpsAcc+=dt;this.fpsN++;
this.fpsT-=dt;
if(this.fpsT<=0){
this.fpsT=.5;
this.el.fpschip.textContent=Math.round(this.fpsN/Math.max(.001,this.fpsAcc))+" FPS";
this.fpsAcc=0;this.fpsN=0;
const p2=engine.player;
if(p2&&p2.body){
const px=p2.body.position.x,pz=p2.body.position.z;
const dirs=["N","NE","E","SE","S","SW","W","NW"];
const di=Math.round((((-p2.yaw)%6.283185+6.283185)%6.283185)/(Math.PI/4))%8;
this.el.coordchip.textContent="X "+(px>=0?"+":"")+px.toFixed(1)+" \u00B7 Z "+(pz>=0?"+":"")+pz.toFixed(1)+" \u00B7 FACING "+dirs[di];
}
}
}
}
