// Firing, spread, recoil and hit resolution.
import {CFG,SETTINGS,DIFFS} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {GFX,PHYS,AUDIO,FX,UI,MATCH,WORLD,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS} from './weapons.js';
import {GrenadeProj} from '../entities/projectiles.js';
import {Cheats} from './cheats.js';

export const WPN={

canFire(ent){
  const st=ent.slotState();
  return st.cd<=0&&st.reloading<=0&&st.mag>0&&ent.pendingSlot<0&&(ent.isBot||ent.switchAnim<=0);
},

aimDir(ent,out){
  if(ent.isPlayer)return GFX.camera.getWorldDirection(out);
  out.set(-Math.sin(ent.yaw)*Math.cos(ent.pitch||0),Math.sin(ent.pitch||0),-Math.cos(ent.yaw)*Math.cos(ent.pitch||0));
  return out.normalize();
},

muzzlePos(ent,out){
  if(ent.isPlayer)return ent.muzzleWorld(out);
  out=ent.eyePos(out);
  this.aimDir(ent,_vf);
  return out.addScaledVector(_vf,.5);
},

spreadDir(dir,s,out){
  out.copy(dir);
  if(s>0){
    _va.set(0,1,0);
    _vb.crossVectors(dir,_va).normalize();
    _vc.crossVectors(_vb,dir).normalize();
    out.addScaledVector(_vb,U.gauss()*s*.7).addScaledVector(_vc,U.gauss()*s*.7).normalize();
  }
  return out;
},

/**
 * Moving while shooting is heavily punished, as in CS: full accuracy only
 * while standing still, and jumping is close to useless.
 */
movementPenalty(ent){
  const b=ent.body;
  if(!b)return 1;
  const spd=Math.hypot(b.velocity.x,b.velocity.z);
  const grounded=ent.groundedInfo&&ent.groundedInfo.grounded;
  let m=1+U.clamp(spd/CFG.walk,0,1)*2.6;
  if(!grounded)m*=3.4;
  if(ent.crouchAmt>.5)m*=.62;
  return m;
},

fire(ent,ratio=1){
  const st=ent.slotState(),cfg=ent.currentCfg();
  if(st.cd>0||st.reloading>0||st.mag<=0)return false;
  if(!ent.isBot&&(ent.pendingSlot>=0||ent.switchAnim>.12))return false;

  if(!Cheats.ammo(ent))st.mag--;
  st.cd=cfg.fireRate;
  st.shotIdx=(st.shotIdx||0)+1;

  const adsT=ent.isPlayer?ent.adsAmt:(ent.isBot?.6:0);
  const base=(cfg.spread+st.bloom)*U.lerp(1,cfg.adsSpreadMult,adsT);
  const spread=base*this.movementPenalty(ent);

  st.bloom=Math.min(cfg.bloomMax,st.bloom+(cfg.bloomPer||0));

  const origin=ent.eyePos(new THREE.Vector3());
  const baseDir=this.aimDir(ent,new THREE.Vector3());
  const muzzle=this.muzzlePos(ent,new THREE.Vector3());

  AUDIO.play(cfg.snd,{pos:muzzle,vol:cfg.silenced?.55:.9});
  if(!cfg.silenced)FX.lightClaim(muzzle,cfg.tracerColor,2.2,10);
  FX.flash(muzzle,cfg.tracerColor,cfg.silenced?.45:.9);

  _vb.crossVectors(baseDir,_va.set(0,1,0)).normalize();
  FX.preset("shell",muzzle,{dir:_vb,count:1});

  if(cfg.classType==="melee"){
    this.melee(ent,cfg,origin,baseDir);
  }else{
    const n=cfg.pellets||1;
    for(let i=0;i<n;i++)this.shot(ent,cfg,origin,baseDir,spread,muzzle);
  }

  if(ent.isPlayer)ent.applyKick(cfg,1,st.shotIdx);
  // Bolt-action guns cycle: the scope drops and the next round is chambered.
  if(cfg.boltAction&&ent.isPlayer)ent.boltT=cfg.fireRate*.55;
  return true;
},

botFire(ent,ratio){this.fire(ent,ratio)},

throwNade(ent,type,dir,power){
  const def=NADE_DEFS[type];
  if(!def||ent.nades[type]<=0)return false;
  if(!Cheats.nades(ent))ent.nades[type]--;
  ent.nadeCd=.8;
  const origin=ent.eyePos(new THREE.Vector3()).addScaledVector(dir,.4);
  engine.add(new GrenadeProj(ent,type,origin,dir,power));
  AUDIO.play("pin",{pos:origin,vol:.5});
  return true;
},

shot(ent,cfg,origin,baseDir,spread,muzzle){
  const dir=this.spreadDir(baseDir,spread,new THREE.Vector3());
  const res=PHYS.combatRay(origin,dir,cfg.range,ent,!!cfg.pierce);
  let end=null;

  if(res.chars.length){
    // `pierce` guns (AWP) pass through a body and can hit whoever is behind.
    const list=cfg.pierce?res.chars:res.chars.slice(0,1);
    let pen=1;
    for(const h of list){
      if(res.wall&&h.dist>res.wall.dist)break;
      let dmg=cfg.damage*(h.part==="head"?cfg.headMult:1)*pen;
      if(cfg.falloff){
        const[t0,t1,f]=cfg.falloff;
        if(h.dist>t0)dmg*=U.lerp(1,f,U.clamp((h.dist-t0)/(t1-t0),0,1));
      }
      h.ud.takeDamage(dmg,ent,{point:h.point.clone(),head:h.part==="head",fromPos:origin,cfg});
      if(cfg.pelletKnock&&h.ud.body){
        h.ud.body.velocity.x+=dir.x*cfg.pelletKnock;
        h.ud.body.velocity.z+=dir.z*cfg.pelletKnock;
      }
      pen*=.55;                            // each body absorbs some of the round
    }
    end=list[0].point;
  }else if(res.wall){
    end=res.wall.point;
    FX.spark(end,res.wall.normal,5,[.85,.72,.5],.8);
    FX.preset("puff",end,{count:2,a:.22});
    FX.bulletHole&&FX.bulletHole(end,res.wall.normal);
  }else{
    end=origin.clone().addScaledVector(dir,cfg.range);
  }
  // Only some rounds draw a visible tracer, as in CS.
  if(Math.random()<.35||cfg.pierce)FX.tracer(muzzle,end,cfg.tracerColor);
},

melee(ent,cfg,origin,baseDir){
  const res=PHYS.combatRay(origin,baseDir,cfg.range,ent,false);
  if(res.chars.length&&(!res.wall||res.chars[0].dist<res.wall.dist)){
    const h=res.chars[0];
    // Backstab: hitting someone from behind is a near-instant kill.
    let dmg=cfg.damage;
    const tgt=h.ud;
    if(tgt.yaw!==undefined){
      _vd.set(-Math.sin(tgt.yaw),0,-Math.cos(tgt.yaw));
      _ve.subVectors(tgt.body.position,origin).setY(0).normalize();
      if(_vd.dot(_ve)>.55)dmg*=cfg.backstab;
    }
    tgt.takeDamage(dmg*(h.part==="head"?cfg.headMult:1),ent,{point:h.point.clone(),head:h.part==="head",fromPos:origin,cfg});
    AUDIO.play("knife_hit",{pos:h.point});
  }
}
};
