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

/**
 * Nearest cell with a walkable floor, searched outward in rings.
 * Used to rescue a body that has somehow ended up below the world.
 */
function nearestStandable(SF,x,z,floorY){
  const step=SF.cell*2;
  for(let r=0;r<=24;r++){
    for(let a=0;a<Math.max(1,r*8);a++){
      const ang=a/Math.max(1,r*8)*Math.PI*2;
      const sx=x+Math.cos(ang)*r*step, sz=z+Math.sin(ang)*r*step;
      const f=SF.groundFloorAt(sx,sz);
      if(f>-900&&f>floorY-2){
        const s=SF.spanAt(sx,sz,f+.05,CFG.stepMax);
        if(s&&s.ceil-s.floor>=CFG.standHeight)return{x:sx,z:sz,y:f};
      }
    }
  }
  return null;
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

  // --- horizontal -----------------------------------------------------------
  // Some map meshes are hollow shells: four vertical faces and no top or bottom
  // (the CT tunnel walls are literally 8 triangles, all vertical). A downward
  // ray passes straight through them, so the span field cannot see them at all
  // and the mesh rays below are the ONLY thing that stops you. They used to run
  // after the position had already been written, correcting velocity for a
  // frame that had happened -- so you walked through the wall and were nudged
  // afterwards. They now run first, and a swept check confirms the result.
  const startX=p.x, startZ=p.z;

  const sp0=Math.hypot(v.x,v.z);
  if(sp0>.005){
    const travel=sp0*dt;
    _vd.set(v.x/sp0,0,v.z/sp0);
    let wallN=null;
    // Sample only ABOVE step height. The riser of a stair or the lip of a ramp
    // is a vertical face too, and treating it as a wall makes every step
    // unclimbable -- stepping over it is what CFG.stepMax is for.
    // Two heights instead of three: a knee-high sample above step height and a
    // chest-high one. The third added a third of the frame's raycasts for
    // almost no extra coverage.
    for(const hh of[CFG.stepMax+.12,1.05]){
      if(hh>h)break;
      _vf.set(p.x,p.y-CFG.feetOff+hh,p.z);
      const n=PHYS.rayWall(_vf,_vd,CFG.radius+travel+.05);
      if(n){wallN=n;break}
    }
    if(wallN){
      const d=v.x*wallN.x+v.z*wallN.z;
      if(d<0){v.x-=wallN.x*d;v.z-=wallN.z*d}   // slide along the face
    }
  }

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

  // Swept confirmation. If the step we just took crossed a wall face anyway,
  // undo it. Only counts faces we moved INTO, so sliding along a wall is not
  // mistaken for crossing it.
  {
    const mdx=p.x-startX, mdz=p.z-startZ;
    const mdist=Math.hypot(mdx,mdz);
    // Only worth confirming a step that actually went somewhere.
    if(mdist>.006){
      _vd.set(mdx/mdist,0,mdz/mdist);
      for(const hh of[CFG.stepMax+.14]){
        if(hh>h)continue;
        _vf.set(startX,p.y-CFG.feetOff+hh,startZ);
        const n=PHYS.rayWall(_vf,_vd,mdist+.02);
        if(n&&(n.x*_vd.x+n.z*_vd.z)<-.15){
          p.x=startX;p.z=startZ;v.x=0;v.z=0;
          break;
        }
      }
    }
  }

  if(WORLD.bounds){
    p.x=U.clamp(p.x,WORLD.bounds.minX+.3,WORLD.bounds.maxX-.3);
    p.z=U.clamp(p.z,WORLD.bounds.minZ+.3,WORLD.bounds.maxZ-.3);
  }

  // --- vertical ------------------------------------------------------------
  feet=p.y-CFG.feetOff;
  const ny=p.y+v.y*dt;
  const newFeet=ny-CFG.feetOff;
  let grounded=false;

  if(v.y<=0){
    // SWEPT landing: catch any floor the body passed through this frame, not
    // just one near where it started. The old test asked spanAt() for a floor
    // at or below the CURRENT feet, so a body that had already dropped below a
    // floor could never re-acquire it and fell forever.
    // While walking, look a little BELOW the feet as well. Smoothing lifts the
    // body above the raw cell floor it was derived from, and a strict sweep
    // then fails to find any floor at all -- the body free-falls for a few
    // frames and snaps back, which is the vibration felt on slopes. Airborne
    // bodies keep the strict sweep so they cannot be caught by a distant floor.
    const lo=ent.snapDown?Math.min(newFeet,feet)-CFG.stepMax:newFeet-.02;
    const land=SF.floorBetween(p.x,p.z,lo,feet+CFG.stepMax);
    if(land!==null){
      // Blend across the cell grid so ramps read as a slope, not as stairs.
      // Bounded to a fraction of a cell: interpolating a discrete field puts
      // the body between neighbouring cell floors, and without a limit that
      // shows up as feet sinking into the ground on steep ground.
      const smooth=SF.smoothFloor(p.x,p.z,land+.05);
      const lim=SF.cell*.55;
      const target=isFinite(smooth)?U.clamp(smooth,land-lim,land+lim):land;
      const ty=target+CFG.feetOff;
      if(ny<=ty||(ent.snapDown&&(p.y-ty)<=CFG.stepMax+.06)){
        p.y=ty;v.y=0;grounded=true;
      }else{
        p.y=ny;                            // genuine fall -- let the arc play out
      }
    }else{
      p.y=ny;
    }
  }else{
    p.y=ny;
  }

  // Ceiling clamp -- this is what stops jumping up through a roof.
  // `p.y` is the body reference point; feet sit at p.y - feetOff and the head
  // at p.y - feetOff + h. Requiring head <= ceil gives the limit below.
  {
    const span=SF.spanAt(p.x,p.z,p.y-CFG.feetOff+.02,CFG.stepMax);
    if(span&&isFinite(span.ceil)){
      const maxY=span.ceil+CFG.feetOff-h;
      if(p.y>maxY){
        p.y=maxY;
        if(v.y>0)v.y=0;                    // bonk
      }
    }
  }

  // Last-resort recovery. Whatever the cause -- a gap in the map mesh, a shove
  // from another body -- nothing should be able to fall out of the world and
  // keep going. Put them back on the nearest floor instead.
  const floorY=WORLD.def.aabb?WORLD.def.aabb.min[1]:-999;
  if(p.y<floorY-4){
    const rescue=nearestStandable(SF,p.x,p.z,floorY);
    if(rescue){
      p.x=rescue.x;p.z=rescue.z;p.y=rescue.y+CFG.feetOff;
      v.set(0,0,0);
      grounded=true;
    }
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

/**
 * Soft separation so operators do not stack inside one another.
 * Each nudge is validated against the span field first -- this used to write
 * positions directly, which could shove a body into a wall or off a ledge.
 */
export function pushApart(list){
  const SF=WORLD&&WORLD.spans;
  const r=CFG.radius*2.05;
  const nudge=(ent,dx,dz)=>{
    const p=ent.body.position;
    if(!SF){p.x+=dx;p.z+=dz;return}
    const feet=p.y-CFG.feetOff;
    const h=bodyHeight(ent);
    if(SF.fits(p.x+dx,p.z+dz,feet,h,CFG.stepMax)){p.x+=dx;p.z+=dz;return}
    // Blocked diagonally -- try each axis on its own so bodies still separate
    // along a wall instead of locking together against it.
    if(SF.fits(p.x+dx,p.z,feet,h,CFG.stepMax))p.x+=dx;
    else if(SF.fits(p.x,p.z+dz,feet,h,CFG.stepMax))p.z+=dz;
  };
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
      nudge(a,-nx*push,-nz*push);
      nudge(c, nx*push, nz*push);
    }
  }
}
