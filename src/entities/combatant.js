// Base entity + Combatant: the shared body/health/movement layer under both
// the local Player and the AI Bot.
import {CFG,GRP,DIFFS,SETTINGS,REGEN} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,INPUT,UI,MATCH,WORLD,engine} from '../core/globals.js';
import {WEAPONS,armourSplit} from '../game/weapons.js';
import {NET2} from '../net/p2p.js';
import {integrateKinematic,doJump as mvDoJump,accelerate as mvAccel,bodyHeight} from './movement.js';

let ENT_ID=1;

export class BaseEntity{
  constructor(type){this.id=ENT_ID++;this.type=type;this.dead=false}
  init(){}
  update(dt){}
  render(dt){}
  destroy(){this.dead=true}
}

export class Combatant extends BaseEntity{
constructor(name){
super("combatant");
this.name=name;this.isBot=false;this.isPlayer=false;
this.team=0;this.accent=0xffffff;
this.maxHealth=100;this.maxArmour=100;
this.health=100;this.armour=0;this.helmet=false;this.hasDefuser=false;
this.alive=false;this.protectT=0;this.hurtT=-99;this.buffT=0;
this.score=0;this.streak=0;this.lastKillT=0;
this.money=800;this.nades={he:0,flash:0,smoke:0,molotov:0};this.nadeMode=false;this.nadeCd=0;this.nadeSel=0;this.blindT=0;this.lostGear=false;
this.stats={k:0,d:0,dmg:0,ping:U.randi(18,70)};
this.slots=[];
this.curSlot=0;this.pendingSlot=-1;this.switchAnim=0;
this.chargeT=-1;
this.body=null;this.bodyInWorld=false;
this.yaw=0;this.visYaw=0;
this.crouchAmt=0;this.slideT=0;this.slideBoosted=false;
this.airJumps=1;this.jumpBufT=0;this.wasGrounded=false;this.fallV=0;
this.stepPhase=0;this.padCd=0;this.teleCd=0;this.lavaTick=0;
this.ctrl={mx:0,mz:0,jump:false,sprint:false,crouch:false,fire:false,ads:false};
this.hitRoot=new THREE.Object3D();this.hitRoot.visible=false;
this.deathT=0;
}
currentCfg(){
const s=this.slots[this.curSlot];
if(s&&s.cfg)return s.cfg;
const f=this.slots.find(x=>x.cfg);
if(f)this.curSlot=this.slots.indexOf(f);
return f?f.cfg:WEAPONS.knife;
}
buildSlots(ids){
// Slot 0 may legitimately be empty on a pistol round.
this.slots=ids.map(id=>({id:id||null,cfg:id?WEAPONS[id]:null,mag:0,reserve:0,cd:0,reloading:0,bloom:0,shotIdx:0}));
const first=this.slots.findIndex(s=>s.cfg);
this.curSlot=first<0?0:first;
}
/** Puts a bought primary into slot 0 and selects it. */
setPrimary(id){
const s0=this.slots[0];
s0.id=id;s0.cfg=WEAPONS[id];
s0.mag=s0.cfg.mag;s0.reserve=s0.cfg.reserve;
s0.cd=.2;s0.reloading=0;s0.bloom=0;s0.shotIdx=0;
this.curSlot=0;this.pendingSlot=-1;
}
hasSlot(i){return !!(this.slots[i]&&this.slots[i].cfg)}
/** Never returns an empty slot -- slot 0 is legitimately empty on pistol rounds. */
slotState(){
const s=this.slots[this.curSlot];
if(s&&s.cfg)return s;
const i=this.slots.findIndex(x=>x&&x.cfg);
if(i>=0){this.curSlot=i;return this.slots[i]}
return s||this.slots[0];
}
eyePos(out){out=out||new THREE.Vector3();out.copy(this.body.position);out.y+=U.lerp(CFG.eyeH,CFG.crouchEye,this.crouchAmt)-CFG.feetOff;return out}
chestPos(out){out=out||new THREE.Vector3();out.copy(this.body.position);out.y+=.25;return out}
/**
 * Hitboxes, measured from the feet upward.
 *
 * These used to top out at 0.92m while eye height is 0.95m -- every level shot
 * sailed over the target's head and the guns felt broken. They now span the
 * operator's actual standing height (CFG.standHeight), with the head box on
 * top so eye-level fire lands in the upper chest.
 */
makeHitMeshes(){
const mk=(w,h,d,y,part)=>{
const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial());
m.visible=false;m.userData={comb:this,part};
m.position.y=y;this.hitRoot.add(m);return m;
};
const H=CFG.standHeight;              // 1.38m
const headH=H*.19;                    // ~0.26m
const torsoH=H*.50;                   // ~0.69m
this.hitTorso=mk(.34,torsoH,.24,H-headH-torsoH/2,"torso");
this.hitHead =mk(.21,headH,.21,H-headH/2,"head");
GFX.scene.add(this.hitRoot);
}

syncHitRoot(){
this.hitRoot.position.set(this.body.position.x,this.body.position.y-CFG.feetOff,this.body.position.z);
this.hitRoot.rotation.y=this.visYaw;
// Crouching lowers the whole silhouette, so the boxes have to follow or you
// could shoot over a crouched enemy that is visibly right in front of you.
const k=U.lerp(1,CFG.crouchHeight/CFG.standHeight,U.clamp(this.crouchAmt||0,0,1));
this.hitRoot.scale.set(1,k,1);
this.hitRoot.updateMatrixWorld(true);
}
spawnBody(pos,yaw){
if(!this.body)this.body=PHYS.makeChar(pos);
else{
this.body.position.copy(pos);
this.body.velocity.set(0,0,0);
PHYS.addBody(this.body);
}
this.bodyInWorld=true;
this.yaw=this.visYaw=yaw;
}
spawnAt(spawn){
this.spawnBody(spawn.p,spawn.yaw!==undefined?spawn.yaw:0);
this.alive=true;
this.health=this.maxHealth;
this.protectT=.35;this.buffT=0;this.streak=0;
this.refillAmmo();
this.crouchAmt=0;this.slideT=0;this.airJumps=1;
this.chargeT=-1;
if(this.onSpawned)this.onSpawned();
AUDIO.play("spawn",{pos:this.body.position,vol:.5,force:true});
}
refillAmmo(){for(const s of this.slots){if(!s.cfg)continue;s.mag=s.cfg.mag;s.reserve=s.cfg.reserve;s.reloading=0;s.cd=.3;s.bloom=0;s.shotIdx=0}}
/**
 * Removes this combatant from the match entirely: no body, no meshes, no HUD
 * presence. Used when the local player takes over a team-mate -- that operator
 * becomes you, so two of them must not remain on the board.
 */
despawn(){
this.alive=false;
this.dead=true;
if(this.bodyInWorld){PHYS.removeBody(this.body);this.bodyInWorld=false}
if(this.visual&&this.visual.root&&GFX)GFX.scene.remove(this.visual.root);
if(this.hitRoot&&GFX)GFX.scene.remove(this.hitRoot);
const i=engine.combatants.indexOf(this);
if(i>=0)engine.combatants.splice(i,1);
const j=engine.entities.indexOf(this);
if(j>=0)engine.entities.splice(j,1);
}

takeDamage(amount,src,info={}){
if(!this.alive)return 0;
if(this.puppet&&!info.net)return 0;
if(this.protectT>0&&!info.env)return 0;
if(src&&src.team&&src.team===this.team&&src!==this&&MATCH.mode.teams&&!SETTINGS.ff)return 0;

let raw=amount*(src&&src.isBot?DIFFS[SETTINGS.diff].dmg:1);
// Armour scales the hit rather than acting as a second health bar, and it
// wears down as it absorbs -- this is the Counter-Strike model.
const split=armourSplit(raw,info.cfg,this.armour,this.helmet,!!info.head);
const toHp=Math.round(split.health);
this.armour=Math.max(0,this.armour-split.armour);

const pt=info.point||_ve.copy(this.body.position).setY(this.body.position.y+1.2);
FX.spark(pt,_vf.set(0,1,0),split.armour>0?6:7,split.armour>0?[.55,.6,.66]:[.75,.2,.16]);
if(toHp>0)this.health-=toHp;
if(src&&src!==this)src.stats.dmg+=toHp;
this.hurtT=engine.time;

if(SETTINGS.dmgNumbers&&!info.noText&&(toHp>=1||info.head))
  FX.floatText(pt,""+Math.max(1,toHp),info.head?"#ff4d5e":"#ffd24d");
if(src===engine.player&&src!==this){
  UI.hitmark(false,info.head);
  AUDIO.play(info.head?"hit_head":"hit");
}
if(NET2.isHost&&src===NET2.guestEnt&&src!==this)NET2.sendEv({e:"hit",k:this.health<=0,h:!!info.head});
if(this===engine.player){
  UI.damageFrom(info.fromPos||null);
  GFX.addTrauma(.22);
  AUDIO.play("hurt");
  UI.vigFlash();
}
if(this.health<=0){
  if(this.puppet){
    this.alive=false;this.deathT=engine.time;this.stats.d++;this.killerRef=src;
    UI.respawnShow("ELIMINATED");
    return toHp;
  }
  this.die(src,info);return toHp;
}
return toHp;
}
die(src,info){
if(!this.alive)return;
if(MATCH.remote)return;
this.alive=false;
this.deathT=engine.time;
this.stats.d++;
if(this.bodyInWorld){PHYS.removeBody(this.body);this.bodyInWorld=false}
MATCH.registerKill(src,this,info);
if(MATCH.mode.roundBased)this.lostGear=true;
if(MATCH.mode.respawn>0&&!MATCH.mode.roundBased)MATCH.respawnQ.push({ent:this,t:MATCH.mode.respawn});
if(this.onDeath)this.onDeath(src,info);
}
// ---------------------------------------------------------------------------
// Movement. See src/entities/movement.js for the jump and wall fixes.
// ---------------------------------------------------------------------------
applyMove(dt){
  const b=this.body;
  const gr=this.groundedInfo||PHYS.ground(b);
  const justLanded=gr.grounded&&!this.wasGrounded;
  this.fallV=b.velocity.y;

  if(justLanded){
    if(this.fallV<-9){
      AUDIO.play("land",{pos:b.position,vol:U.clamp(-this.fallV/20,.3,1)});
      if(this===engine.player)this.landDip=Math.min(.26,-this.fallV*.011);
      FX.preset("puff",_ve.set(b.position.x,b.position.y-CFG.feetOff+.05,b.position.z),{count:5,a:.3});
      // Long falls hurt, as they do in CS.
      if(this.fallV<-15)this.takeDamage(Math.round((-this.fallV-15)*3.4),null,{env:true,noText:true});
    }
    if(engine.time<this.jumpBufT){this.doJump(gr);this.jumpBufT=0}
  }
  this.wasGrounded=gr.grounded;

  const wantCrouch=this.ctrl.crouch;
  // Do not allow standing up into a ceiling.
  let canStand=true;
  if(!wantCrouch&&this.crouchAmt>.05&&WORLD.spans){
    const feet=b.position.y-CFG.feetOff;
    canStand=!!WORLD.spans.fits(b.position.x,b.position.z,feet,CFG.standHeight,CFG.stepMax);
  }
  this.crouchAmt=U.damp(this.crouchAmt,(wantCrouch||!canStand)?1:0,11,dt);

  let mx=this.ctrl.mx,mz=this.ctrl.mz;
  const wl=Math.sqrt(mx*mx+mz*mz);
  if(wl>1){mx/=wl;mz/=wl}
  const sy=Math.sin(this.yaw),cy=Math.cos(this.yaw);
  const wishX=mx*cy-mz*sy;
  const wishZ=-mx*sy-mz*cy;

  // CS grammar: one run speed, shift to walk quietly, crouch is slowest.
  let targetSpeed=this.ctrl.sprint&&!wantCrouch?CFG.sprint:(wantCrouch?CFG.crouchSpd:CFG.walk);

  if(gr.grounded){
    const f=Math.min(CFG.fric*dt,1);
    b.velocity.x-=b.velocity.x*f;
    b.velocity.z-=b.velocity.z*f;
    this.accelerate(b,wishX,wishZ,targetSpeed,CFG.accelG,dt);
  }else{
    this.accelerate(b,wishX,wishZ,CFG.airWish,(WORLD&&WORLD.def.airAccel)||CFG.accelA,dt);
  }

  const jumpPressed=this.ctrl.jump;
  if(jumpPressed)this.jumpBufT=engine.time+.13;
  if(gr.grounded&&engine.time<this.jumpBufT)this.doJump(gr);

  integrateKinematic(this,dt);

  // Footstep audio -- shift-walking is silent, which is the point of walking.
  const g2=this.groundedInfo;
  if(g2&&g2.grounded&&!this.ctrl.sprint&&targetSpeed>.1){
    const spd=Math.sqrt(b.velocity.x*b.velocity.x+b.velocity.z*b.velocity.z);
    if(spd>1.0){
      this.stepPhase+=spd*dt;
      if(this.stepPhase>1.35){
        this.stepPhase=0;
        AUDIO.play("step_dirt",{pos:b.position,vol:wantCrouch?.22:.5});
      }
    }
  }
}

accelerate(b,wx,wz,wishSpeed,accel,dt){mvAccel(b,wx,wz,wishSpeed,accel,dt)}
doJump(gr){mvDoJump(this)}

/** Armour trickles back; health does not regenerate at all in this build. */
regen(dt){
  if(!this.alive)return;
  if(engine.time-this.hurtT<REGEN.delay)return;
  if(this.armour<this.maxArmour&&this.armour>0)
    this.armour=Math.min(this.maxArmour,this.armour+REGEN.rate*dt);
}
}
