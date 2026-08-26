// Radar intel.
//
// The radar used to draw every living enemy, everywhere, always -- effectively
// a permanent wallhack. Enemies are now only plotted when the team can actually
// account for them:
//
//   * SIGHT   - you or a living team-mate has line of sight to them.
//   * GUNFIRE - they fired an unsuppressed shot recently; the position is
//               remembered briefly and then goes stale, the way a sound cue
//               would.
//
// Both fade, so a contact that breaks line of sight leaves a short trail of
// last-known position rather than vanishing on the same frame.
import {engine, PHYS, MATCH} from '../core/globals.js';

/** How long a contact stays on the radar after the cue that revealed it. */
export const INTEL={
  sightHold:1.1,        // seconds a seen enemy lingers after breaking LOS
  fireHold:2.4,         // seconds a shot gives you their position
  silencedHold:0.9,     // suppressed weapons give away much less
  scanInterval:0.12     // seconds between line-of-sight sweeps
};

let nextScan=0;
const _a=new THREE.Vector3(), _b=new THREE.Vector3();

/** Called by the weapon system whenever a shot is fired. */
export function noteShot(ent,cfg){
  if(!ent)return;
  ent.lastFireT=engine.time;
  ent.lastFireSilenced=!!(cfg&&cfg.silenced);
}

/**
 * Refreshes `radarSeenT` for every enemy a living member of `team` can see.
 * Throttled -- line of sight is the expensive part and a radar does not need
 * to be frame-accurate.
 * @param {number} team side doing the looking
 * @param {boolean} [force] bypass the throttle (tests, or a forced refresh)
 */
export function scan(team,force){
  if(!force&&engine.time<nextScan)return;
  nextScan=engine.time+INTEL.scanInterval;

  const watchers=engine.combatants.filter(c=>c.alive&&c.team===team);
  const foes=engine.combatants.filter(c=>c.alive&&c.team&&c.team!==team);
  if(!watchers.length||!foes.length)return;

  for(const foe of foes){
    // A bot that has already acquired this enemy counts as seeing them; that
    // work is done by its perception pass, so reuse it instead of re-raycasting.
    let seen=false;
    for(const w of watchers){
      if(w.isBot&&w.target===foe&&engine.time<w.memory){seen=true;break}
    }
    if(!seen){
      foe.chestPos(_b);
      for(const w of watchers){
        if(w.isBot&&!w.isPlayer&&w.target)continue;   // already handled above
        w.eyePos(_a);
        if(PHYS.losClear(_a,_b,w)){seen=true;break}
      }
    }
    if(seen)foe.radarSeenT=engine.time;
  }
}

/**
 * Should this combatant appear on `viewer`'s radar?
 * @returns {{show:boolean, fresh:boolean}} fresh = currently observed, as
 *          opposed to a fading last-known position.
 */
export function radarVisible(viewer,c){
  if(!c.alive)return {show:false,fresh:false};
  const teams=MATCH.mode&&MATCH.mode.teams;
  // Team-mates are always shown -- that is your own side reporting in.
  if(teams&&viewer.team&&c.team===viewer.team)return {show:true,fresh:true};

  const now=engine.time;
  const sight=now-(c.radarSeenT||-999);
  if(sight<INTEL.sightHold)return {show:true,fresh:sight<INTEL.scanInterval*2};

  const hold=c.lastFireSilenced?INTEL.silencedHold:INTEL.fireHold;
  const fire=now-(c.lastFireT||-999);
  if(fire<hold)return {show:true,fresh:false};

  return {show:false,fresh:false};
}
