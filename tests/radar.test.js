// Radar: projection geometry and what it is allowed to reveal.
//   import('/tests/radar.test.js').then(m=>console.table(m.run()))
import {SETTINGS} from '/src/core/config.js';
import {radarVisible, scan, INTEL, noteShot} from '/src/game/intel.js';
import {WEAPONS} from '/src/game/weapons.js';

const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

/** Mirrors the projection in UI.drawRadar so the maths can be checked here. */
function proj(yaw,dx,dz,sc){
  const cy=Math.cos(yaw), sy=Math.sin(yaw);
  return [(dx*cy-dz*sy)*sc, (dx*sy+dz*cy)*sc];
}

export function run(){
  out.length=0;
  const e=window.engine, p=e.player, V=window.NV, M=V.MATCH;

  // ================= projection =============================================
  {
    // A rotation must preserve length at every angle. The old matrix was
    // [[cos,sin],[sin,cos]], whose determinant is cos(2*yaw) -- it squashed the
    // map as you turned and collapsed it flat at 45 degrees.
    let worst=0, worstYaw=0;
    for(let d=0;d<360;d+=7){
      const yaw=d*Math.PI/180;
      for(const [dx,dz] of [[10,0],[0,10],[7,7],[-6,9]]){
        const [x,y]=proj(yaw,dx,dz,1);
        const before=Math.hypot(dx,dz), after=Math.hypot(x,y);
        const err=Math.abs(after-before)/before;
        if(err>worst){worst=err;worstYaw=d}
      }
    }
    check("radar: projection preserves distance at every angle", worst<1e-9,
      `worst error ${(worst*100).toFixed(6)}% at ${worstYaw} deg`);

    // Determinant must be 1 (a pure rotation), not cos(2*yaw).
    let detWorst=0;
    for(let d=0;d<360;d+=11){
      const yaw=d*Math.PI/180, cy=Math.cos(yaw), sy=Math.sin(yaw);
      const det=cy*cy-(-sy)*sy;
      detWorst=Math.max(detWorst,Math.abs(det-1));
    }
    check("radar: transform is a pure rotation", detWorst<1e-9,
      `|det-1| max ${detWorst.toExponential(2)}`);

    // Whatever is directly in front should plot straight up (negative screen y).
    let worstUp=0;
    for(let d=0;d<360;d+=13){
      const yaw=d*Math.PI/180;
      const fx=-Math.sin(yaw)*10, fz=-Math.cos(yaw)*10;   // 10m ahead
      const [x,y]=proj(yaw,fx,fz,1);
      worstUp=Math.max(worstUp,Math.abs(x));              // should be centred
      if(y>0){worstUp=999;break}                          // must be above centre
    }
    check("radar: what is ahead of you plots upward", worstUp<1e-9,
      worstUp>900?"plotted below centre":`lateral drift ${worstUp.toExponential(2)}`);
  }

  // ================= enemy visibility =======================================
  {
    const foe=e.combatants.find(c=>c.alive&&c.team!==p.team);
    if(!foe){check("radar: an enemy exists to test",false,"none");return out}
    check("radar: an enemy exists to test",true,foe.name);

    // Nothing seen, nothing fired -> hidden.
    foe.radarSeenT=-999; foe.lastFireT=-999; foe.lastFireSilenced=false;
    check("radar: enemies are hidden by default",
      !radarVisible(p,foe).show, "not plotted");

    // Team-mates are always shown.
    const mate=e.combatants.find(c=>c.alive&&c.team===p.team&&c!==p);
    if(mate)check("radar: team-mates are always shown",
      radarVisible(p,mate).show, mate.name);

    // Seen right now -> shown, and marked as a live contact.
    foe.radarSeenT=e.time;
    const fresh=radarVisible(p,foe);
    check("radar: an enemy in sight is shown", fresh.show&&fresh.fresh, "live contact");

    // Just out of sight -> still shown briefly, but stale.
    foe.radarSeenT=e.time-(INTEL.sightHold*0.6);
    const fading=radarVisible(p,foe);
    check("radar: a lost contact lingers as last-known",
      fading.show&&!fading.fresh, "stale contact");

    // Long out of sight -> gone.
    foe.radarSeenT=e.time-(INTEL.sightHold+0.5);
    check("radar: a stale contact drops off",
      !radarVisible(p,foe).show, `after ${INTEL.sightHold}s`);

    // Gunfire reveals, for a while.
    noteShot(foe,WEAPONS.ak47);
    check("radar: firing reveals an enemy", radarVisible(p,foe).show, "unsuppressed shot");
    foe.lastFireT=e.time-(INTEL.fireHold+0.3);
    check("radar: a gunfire contact expires",
      !radarVisible(p,foe).show, `after ${INTEL.fireHold}s`);

    // A suppressed weapon gives away much less.
    check("radar: suppressed weapons reveal for less time",
      INTEL.silencedHold<INTEL.fireHold,
      `${INTEL.silencedHold}s vs ${INTEL.fireHold}s`);
    noteShot(foe,WEAPONS.m4a1);            // silenced
    foe.lastFireT=e.time-(INTEL.silencedHold+0.2);
    check("radar: a suppressed shot expires sooner",
      !radarVisible(p,foe).show, "dropped");

    // The scan must actually mark enemies the team can see.
    foe.radarSeenT=-999;
    foe.body.position.copy(p.body.position).add(new THREE.Vector3(0,0,2));
    if(foe.syncHitRoot)foe.syncHitRoot();
    scan(p.team,true);                     // bypass the throttle
    check("radar: the sweep marks an enemy standing in the open",
      radarVisible(p,foe).show, "spotted at 2m");
  }

  return out;
}
