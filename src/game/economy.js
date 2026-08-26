// Buying. One entry point used by the buy menu, the bots and the P2P host.
import {SETTINGS,ECONOMY} from '../core/config.js';
import {UI,MATCH,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS,GEAR,defaultPistol} from './weapons.js';
import {Cheats} from './cheats.js';

/** Everything purchasable, keyed the way the buy menu addresses it. */
export function priceOf(item,team){
  if(GEAR[item]){
    // Buying a helmet when you already own the vest only costs the difference.
    return GEAR[item].price;
  }
  if(NADE_DEFS[item]){
    const d=NADE_DEFS[item];
    return (team===1&&d.ctPrice)?d.ctPrice:d.price;
  }
  const w=WEAPONS[item];
  return w?w.price:0;
}

export function displayName(item,team){
  if(GEAR[item])return GEAR[item].name;
  if(NADE_DEFS[item]){
    const d=NADE_DEFS[item];
    return (team===1&&d.ctName)?d.ctName:d.name;
  }
  return WEAPONS[item]?WEAPONS[item].name:item;
}

/** Reasons an item cannot be bought, or null when it can. */
export function buyBlocked(c,item){
  const team=c.team;
  const price=priceOf(item,team);

  if(GEAR[item]){
    const g=GEAR[item];
    if(g.team&&g.team!==team)return "CT ONLY";
    if(item==="defuser"&&c.hasDefuser)return "OWNED";
    if(item==="kevlar"&&c.armour>=95)return "OWNED";
    if(item==="kevlar_helmet"&&c.armour>=95&&c.helmet)return "OWNED";
  }else if(NADE_DEFS[item]){
    const max=NADE_DEFS[item].max||1;
    if(c.nades[item]>=max)return "MAX";
    // CS caps you at four grenades total.
    const total=Object.values(c.nades).reduce((a,b)=>a+b,0);
    if(total>=4)return "FULL";
  }else{
    const w=WEAPONS[item];
    if(!w)return "N/A";
    if(w.team&&w.team!==team)return team===1?"T ONLY":"CT ONLY";
    if(w.slot===3)return "N/A";                    // knife is never bought
    if(c.slots.some(sl=>sl&&sl.id===item))return "OWNED";
  }
  if(!Cheats.money(c)&&(c.money||0)<price)return "NO FUNDS";
  return null;
}

/**
 * Applies a purchase. Returns true when money actually changed hands.
 * @param {Combatant} c buyer
 * @param {string} item weapon id, gear id or grenade id
 */
export function applyBuy(c,item){
  if(!c||!c.alive)return false;
  if(buyBlocked(c,item))return false;
  const price=priceOf(item,c.team);
  if(!Cheats.money(c))c.money-=price;

  if(GEAR[item]){
    const g=GEAR[item];
    if(item==="defuser")c.hasDefuser=true;
    else{c.armour=g.armour;c.helmet=g.helmet}
    return true;
  }
  if(NADE_DEFS[item]){
    c.nades[item]++;
    if(c===engine.player&&UI)UI.nadeBar(c);
    return true;
  }
  const w=WEAPONS[item];

  // "Carry all" turns the loadout into an armoury: every purchase gets its own
  // slot instead of replacing the one you already had.
  if(SETTINGS.carryAll&&c===engine.player){
    c.addWeapon(item);
    if(UI)UI.slotsDirty=true;
    return true;
  }

  if(w.slot===2){
    // Pistol replaces the sidearm in slot 1.
    const s=c.slots[1];
    s.id=item;s.cfg=w;s.mag=w.mag;s.reserve=w.reserve;s.cd=.2;s.reloading=0;s.bloom=0;
    if(c===engine.player){
      c.curSlot=1;
      if(c.refreshHeld)c.refreshHeld();
      if(UI)UI.slotsDirty=true;
    }
    return true;
  }
  c.setPrimary(item);
  if(c===engine.player&&c.refreshHeld)c.refreshHeld();
  if(UI)UI.slotsDirty=true;
  return true;
}

/** Round-start reset: gear is lost on death, kept when you survive. */
export function refreshLoadout(c,pistolRound){
  if(pistolRound){
    c.money=ECONOMY.pistolRoundMoney;
    c.armour=0;c.helmet=false;c.hasDefuser=false;
    c.nades={he:0,flash:0,smoke:0,molotov:0};
    c.buildSlots([null,defaultPistol(c.team),"knife"]);
  }else if(c.lostGear){
    c.armour=0;c.helmet=false;c.hasDefuser=false;
    c.nades={he:0,flash:0,smoke:0,molotov:0};
    c.buildSlots([null,defaultPistol(c.team),"knife"]);
  }
  c.lostGear=false;
  c.leftSpawn=false;        // re-opens the in-spawn buy window
  c.refillAmmo();
}
