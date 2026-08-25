// Kinematic character controller.
//
// Two bugs lived here before:
//
// 1. JUMP. The ground test read
//        else if (v.y<=.01 && p.y<=ty+.45) { ny=ty; v.y=0; grounded=true }
//    which snaps the body straight onto the floor the instant vertical velocity
//    turns negative anywhere within 45cm of it. With a 66cm jump apex that is
//    most of the descent, so the fall was a single-frame teleport -- exactly the
//    "pulled insanely fast to the ground, no float" report. Snap-down is only
//    correct when you are WALKING off a step, so it is now gated behind
//    `snapDown`, which a jump clears and a landing restores.
//
// 2. WALLS/CEILINGS. Blocking used a single-layer heightfield that never
//    recorded wall tops and had no ceiling concept. Movement now sweeps against
//    the span field: a move is allowed only if the destination has a free span
//    tall enough for the body.

import {CFG} from '../core/config.js';
import {U,_vd,_ve,_vf} from '../core/util.js';
import {WORLD,PHYS,AUDIO,FX,engine} from '../core/globals.js';

/**
 * Can a capsule of `h` clearance stand centred at (x,z) with feet at `feet`?
 * Samples the leading face of the capsule, not just its centre, so you cannot
 * bury half your body in a wall between grid cells.
 */
function canOccupy(SF,x,z,feet,h,ax,sgn){
  const r=CFG.radius;
  if(!SF.fits(x,z,feet,h,CFG.stepMax))return false;
  if(ax===0){
    const ex=x+sgn*r;
    if(!SF.fits(ex,z,feet,h,CFG.stepMax))return false;
    if(!SF.fits(ex,z-r*.7,feet,h,CFG.stepMax))return false;
    if(!SF.fits(ex,z+r*.7,feet,h,CFG.stepMax))return false;
  }else{
    const ez=z+sgn*r;
    if(!SF.fits(x,ez,feet,h,CFG.stepMax))return false;
    if(!SF.fits(x-r*.7,ez,feet,h,CFG.stepMax))return false;
    if(!SF.fits(x+r*.7,ez,feet,h,CFG.stepMax))return false;
  }
  return true;
}

/** Body clearance needed right now, blended over the crouch transition. */
export function bodyHeight(ent){
  return U.lerp(CFG.standHeight,CFG.crouchHeight,U.clamp(ent.crouchAmt||0,0,1));
}

export function integrateKinematic(ent,dt){
  const b=ent.body,p=b.position,v=b.velocity;
  const def=WORLD.def, SF=WORLD.spans;
  if(!SF){p.y+=v.y*dt;return}

  // --- gravity -------------------------------------------------------------
  // Characters use a reduced scale so the jump arc floats like CS while
  // grenades and bullets still fall at full world gravity.
  v.y+=def.grav*(CFG.charGravScale||1)*dt;
  if(v.y<-28)v.y=-28;

  const h=bodyHeight(ent);
  let feet=p.y-CFG.feetOff;

  // --- horizontal sweep ----------------------------------------------------
  const sp=Math.hypot(v.x,v.z);
  if(sp>1e-4){
    // Substep so a fast body cannot tunnel through a thin wall in one frame.
    const steps=Math.min(10,Math.max(1,Math.ceil(sp*dt/(CFG.radius*.55))));
    const sdt=dt/steps;
    for(let s=0;s<steps;s++){
      feet=p.y-CFG.feetOff;
      if(v.x!==0){
        const nx=p.x+v.x*sdt;
        if(canOccupy(SF,nx,p.z,feet,h,0,Math.sign(v.x)))p.x=nx;
        else v.x=0;                       // blocked on X, Z survives -> slide
      }
      if(v.z!==0){
        const nz=p.z+v.z*sdt;
        if(canOccupy(SF,p.x,nz,feet,h,1,Math.sign(v.z)))p.z=nz;
        else v.z=0;
      }
      if(v.x===0&&v.z===0)break;
    }
  }

  // Thin, single-sided geometry (a plane with no thickness) never registers in
  // the span stack, so keep the old sweep rays as a second line of defence.
  const sp2=Math.hypot(v.x,v.z);
  if(sp2>.01){
    _vd.set(v.x/sp2,0,v.z/sp2);
    let wallN=null;
    for(const hh of[.14,.42,.80]){
      if(hh>h)break;
      _vf.set(p.x,p.y-CFG.feetOff+hh,p.z);
      const n=PHYS.rayWall(_vf,_vd,CFG.radius+.10);
      if(n){wallN=n;break}
    }
    if(wallN){
      const d=v.x*wallN.x+v.z*wallN.z;
      if(d<0){v.x-=wallN.x*d;v.z-=wallN.z*d}
    }
  }

  if(WORLD.bounds){
    p.x=U.clamp(p.x,WORLD.bounds.minX+.3,WORLD.bounds.maxX-.3);
    p.z=U.clamp(p.z,WORLD.bounds.minZ+.3,WORLD.bounds.maxZ-.3);
  }

  // --- vertical ------------------------------------------------------------
  feet=p.y-CFG.feetOff;
  const span=SF.spanAt(p.x,p.z,feet+.02,CFG.stepMax);
  let grounded=false;

  if(span){
    const ty=span.floor+CFG.feetOff;
    const ny=p.y+v.y*dt;

    if(v.y<=0){
      if(ny<=ty){
        // Landed this frame.
        p.y=ty;v.y=0;grounded=true;
      }else if(ent.snapDown&&(p.y-ty)<=CFG.stepMax+.06){
        // Walking off a kerb: stay glued instead of briefly going airborne.
        p.y=ty;v.y=0;grounded=true;
      }else{
        p.y=ny;                            // genuine fall -- let the arc play out
      }
    }else{
      p.y=ny;
    }

    // Ceiling clamp -- this is what stops jumping up through a roof.
    // `p.y` is the body reference point; feet sit at p.y - feetOff and the head
    // at p.y - feetOff + h. Requiring head <= ceil gives the limit below.
    if(isFinite(span.ceil)){
      const maxY=span.ceil+CFG.feetOff-h;
      if(p.y>maxY){
        p.y=maxY;
        if(v.y>0)v.y=0;                    // bonk
      }
    }
  }else{
    // Void cell (off-mesh). Fall, and let the bounds clamp / respawn handle it.
    p.y+=v.y*dt;
  }

  // A jump must not be immediately re-glued to the floor by snap-down.
  ent.snapDown=grounded;
  ent.groundedInfo={grounded,ny:1,surf:def.surf};
  return grounded;
}

/** Called on a real jump: clears snap-down so the arc is allowed to happen. */
export function doJump(ent){
  const def=WORLD.def;
  ent.body.velocity.y=def.jumpVel!==undefined?def.jumpVel:CFG.jump;
  ent.snapDown=false;
  ent.jumpBufT=0;
  ent.wasGrounded=false;
  if(ent.groundedInfo)ent.groundedInfo.grounded=false;
  AUDIO&&AUDIO.play("jump",{pos:ent.body.position,vol:.45});
}

/** Quake-style air/ground acceleration toward the wish direction. */
export function accelerate(b,wx,wz,wishSpeed,accel,dt){
  if(wx===0&&wz===0)return;
  const cur=b.velocity.x*wx+b.velocity.z*wz;
  const add=wishSpeed-cur;
  if(add<=0)return;
  const acc=Math.min(accel*wishSpeed*dt,add);
  b.velocity.x+=wx*acc;b.velocity.z+=wz*acc;
}

/** Soft separation so operators do not stack inside one another. */
export function pushApart(list){
  const r=CFG.radius*2.05;
  for(let i=0;i<list.length;i++){
    const a=list[i];if(!a.alive||!a.body)continue;
    for(let j=i+1;j<list.length;j++){
      const c=list[j];if(!c.alive||!c.body)continue;
      const dx=c.body.position.x-a.body.position.x, dz=c.body.position.z-a.body.position.z;
      const dy=Math.abs(c.body.position.y-a.body.position.y);
      if(dy>1.3)continue;
      const d2=dx*dx+dz*dz;
      if(d2>=r*r||d2<1e-6)continue;
      const d=Math.sqrt(d2), push=(r-d)*.5;
      const nx=dx/d, nz=dz/d;
      a.body.position.x-=nx*push;a.body.position.z-=nz*push;
      c.body.position.x+=nx*push;c.body.position.z+=nz*push;
    }
  }
}
