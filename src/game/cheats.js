// Optional practice rules.
//
// These apply to the LOCAL player only, and only when this client is actually
// simulating them. A P2P guest is a puppet driven by the host's snapshots, so
// its ammo, grenades and money are decided on the other machine -- letting the
// toggles pretend otherwise would just desync the HUD.
import {SETTINGS, ECONOMY} from '../core/config.js';
import {engine} from '../core/globals.js';
import {NET2} from '../net/p2p.js';

/** True when practice rules are allowed to affect this entity. */
export function applies(ent){
  if(!ent||ent!==engine.player)return false;
  if(ent.puppet||NET2.joined)return false;      // host is authoritative
  return true;
}

export const Cheats={
  ammo(ent){return SETTINGS.infAmmo&&applies(ent)},
  nades(ent){return SETTINGS.infNades&&applies(ent)},
  money(ent){return SETTINGS.infMoney&&applies(ent)},

  /** Per-frame top-ups, so the HUD never reads empty. */
  tick(ent){
    if(!applies(ent)||!ent.alive)return;
    if(SETTINGS.infMoney)ent.money=ECONOMY.maxMoney;
    if(SETTINGS.infNades){
      // Keep one of each in hand; the throw itself is what stays free.
      for(const k of ["he","flash","smoke","molotov"])
        if(ent.nades[k]<1)ent.nades[k]=1;
    }
    if(SETTINGS.infAmmo){
      for(const s of ent.slots){
        if(!s.cfg)continue;
        s.reserve=s.cfg.reserve;
        // Do not refill mid-reload, or the reload animation never resolves.
        if(s.reloading<=0&&s.mag<s.cfg.mag)s.mag=s.cfg.mag;
      }
    }
  },

  /** True when any practice rule is active -- used to badge the HUD. */
  anyOn(){
    return SETTINGS.infAmmo||SETTINGS.infNades||SETTINGS.infMoney;
  }
};
