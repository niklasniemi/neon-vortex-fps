// Optional rules: team-mate takeover, and the practice (unlimited) toggles.
//   import('/tests/rules.test.js').then(m=>console.table(m.run()))
import {SETTINGS, ECONOMY} from '/src/core/config.js';
import {Cheats} from '/src/game/cheats.js';
import {WPN} from '/src/game/wpnsystem.js';
import {applyBuy, buyBlocked} from '/src/game/economy.js';

const DT=1/60;
const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

export function run(){
  out.length=0;
  const e=window.engine, p=e.player, V=window.NV, M=V.MATCH, SF=V.WORLD.spans;
  const saved={takeover:SETTINGS.takeover,ammo:SETTINGS.infAmmo,
               nades:SETTINGS.infNades,money:SETTINGS.infMoney,
               phase:M.phase,round:M.mode.roundPhase};
  M.phase="live"; M.mode.roundPhase="live";

  const revive=()=>{
    p.alive=true;p.health=100;p.armour=0;p.helmet=false;p.protectT=0;
    p.takeoverT=-1;p.hasBomb=false;
    p.applyTeamLoadout(p.team===1?"m4a1":"ak47");
    p.refillAmmo();
  };

  // ======================= TAKEOVER =========================================
  {
    SETTINGS.takeover=true;
    revive();
    const matesBefore=p.livingMates();
    check("takeover: team-mates are available", matesBefore.length>0,
      `${matesBefore.length} alive`);

    if(matesBefore.length){
      // The implementation picks a RANDOM survivor, so give every candidate the
      // same distinctive state -- then the assertions hold whoever it lands on.
      const mark=(b)=>{
        b.alive=true;b.health=77;b.armour=44;b.helmet=true;b.hasDefuser=false;
        b.money=3300;b.nades={he:1,flash:2,smoke:0,molotov:0};
        b.setPrimary(b.team===1?"m4a1":"ak47");
        b.refillAmmo();
        b.slots[0].mag=7;
      };
      matesBefore.forEach(mark);
      const posBefore=new Map(matesBefore.map(b=>[b,b.body.position.clone()]));
      const teamBefore=e.combatants.filter(c=>c.team===p.team&&c.alive).length;
      const rosterBefore=e.combatants.length;

      // Kill the player for real.
      p.takeDamage(9999,null,{env:true,noText:true});
      const teamAfterDeath=e.combatants.filter(c=>c.team===p.team&&c.alive).length;
      check("takeover: dying schedules a switch", p.takeoverT>0,
        `${p.takeoverT>0?p.takeoverT.toFixed(2)+"s":"not scheduled"}`);
      check("takeover: you are dead until it happens", !p.alive, `alive=${p.alive}`);

      // Run out the delay.
      for(let i=0;i<200&&!p.alive;i++){e.time+=DT;p.update(DT)}

      check("takeover: you are back in the fight", p.alive, `alive=${p.alive}`);
      const host=p.takeoverFrom;
      const hostPos=host?posBefore.get(host):null;
      check("takeover: it reports who you took over", !!host,
        host?host.name:"not recorded");
      check("takeover: you inherit their position",
        !!hostPos&&p.body.position.distanceTo(hostPos)<0.6,
        hostPos?`${p.body.position.distanceTo(hostPos).toFixed(2)}m from where they stood`:"n/a");
      check("takeover: you inherit their health and armour",
        p.health===77&&p.armour===44&&p.helmet===true,
        `hp ${p.health} armour ${p.armour} helmet ${p.helmet}`);
      check("takeover: you inherit their weapon and magazine",
        p.slots[0].id===(p.team===1?"m4a1":"ak47")&&p.slots[0].mag===7,
        `${p.slots[0].id} ${p.slots[0].mag} rounds`);
      check("takeover: you inherit their grenades and money",
        p.nades.flash===2&&p.money===3300,
        `flash ${p.nades.flash}, $${p.money}`);
      check("takeover: the operator you took over is gone",
        !!host&&!e.combatants.includes(host),
        host&&!e.combatants.includes(host)?`${host.name} removed`:"still on the board");
      check("takeover: the roster shrinks by exactly one",
        e.combatants.length===rosterBefore-1,
        `${e.combatants.length} (was ${rosterBefore})`);
      // Taking over is not a free respawn: you occupy a team-mate rather than
      // adding a body, so the side stays exactly as strong as your death left it.
      const teamNow=e.combatants.filter(c=>c.team===p.team&&c.alive).length;
      check("takeover: does not resurrect your side",
        teamNow===teamAfterDeath,
        `${teamNow} alive, ${teamAfterDeath} right after you died (${teamBefore} before)`);
      check("takeover: your death still cost the team a body",
        teamNow===teamBefore-1,
        `${teamNow} vs ${teamBefore} before you died`);
      check("takeover: no spawn protection is granted", p.protectT===0,
        `protectT ${p.protectT}`);
    }
  }

  // Last man standing: nothing to take over, so you spectate.
  {
    SETTINGS.takeover=true;
    revive();
    const mates=p.livingMates();
    const hidden=mates.map(m=>{m.alive=false;return m});
    p.takeDamage(9999,null,{env:true,noText:true});
    check("takeover: last player alive just spectates", p.takeoverT===-1&&!p.alive,
      `takeoverT ${p.takeoverT}`);
    for(const m of hidden)m.alive=true;
  }

  // Rule off: never switches.
  {
    SETTINGS.takeover=false;
    revive();
    p.takeDamage(9999,null,{env:true,noText:true});
    check("takeover: disabled means you stay dead", p.takeoverT===-1&&!p.alive,
      `takeoverT ${p.takeoverT}`);
  }

  // ======================= PRACTICE RULES ===================================
  revive();
  SETTINGS.infAmmo=SETTINGS.infNades=SETTINGS.infMoney=false;
  check("practice: all off by default in this run", !Cheats.anyOn(), "clean");

  // --- ammo ---
  {
    SETTINGS.infAmmo=true;
    const st=p.slots[p.curSlot];
    st.mag=st.cfg.mag;st.reserve=st.cfg.reserve;st.cd=0;st.reloading=0;
    const magBefore=st.mag;
    for(let i=0;i<8;i++){st.cd=0;WPN.fire(p,1)}
    check("practice: unlimited ammo never empties the magazine",
      st.mag===magBefore, `${st.mag}/${magBefore} after 8 shots`);

    st.reserve=5;
    Cheats.tick(p);
    check("practice: unlimited ammo tops the reserve back up",
      st.reserve===st.cfg.reserve, `reserve ${st.reserve}`);

    SETTINGS.infAmmo=false;
    st.mag=st.cfg.mag;st.cd=0;
    for(let i=0;i<3;i++){st.cd=0;WPN.fire(p,1)}
    check("practice: ammo drains normally when off",
      st.mag===st.cfg.mag-3, `${st.mag}/${st.cfg.mag} after 3 shots`);
  }

  // --- grenades ---
  {
    SETTINGS.infNades=true;
    p.nades={he:1,flash:1,smoke:1,molotov:1};
    const dir=new THREE.Vector3(0,0,-1);
    for(let i=0;i<4;i++){p.nadeCd=0;WPN.throwNade(p,"he",dir.clone(),10)}
    check("practice: unlimited grenades never run out",
      p.nades.he>=1, `he ${p.nades.he} after 4 throws`);

    SETTINGS.infNades=false;
    p.nades.he=2;p.nadeCd=0;
    WPN.throwNade(p,"he",dir.clone(),10);
    check("practice: grenades are consumed when off",
      p.nades.he===1, `he ${p.nades.he} after 1 throw`);
  }

  // --- money ---
  {
    SETTINGS.infMoney=true;
    p.money=0;
    Cheats.tick(p);
    check("practice: unlimited money keeps the wallet full",
      p.money===ECONOMY.maxMoney, `$${p.money}`);

    p.money=0;
    check("practice: nothing reads as unaffordable",
      buyBlocked(p,"awp")!=="NO FUNDS", String(buyBlocked(p,"awp")));
    p.money=0;p.slots[0].id=null;p.slots[0].cfg=null;
    const bought=applyBuy(p,"awp");
    check("practice: you can buy with an empty wallet",
      bought&&p.slots[0].id==="awp"&&p.money===0,
      `bought=${bought} slot0=${p.slots[0].id} money=${p.money}`);

    SETTINGS.infMoney=false;
    p.money=100;p.slots[0].id=null;p.slots[0].cfg=null;
    check("practice: price is enforced again when off",
      buyBlocked(p,"awp")==="NO FUNDS", String(buyBlocked(p,"awp")));
  }

  // --- scope: bots must never benefit ---
  {
    SETTINGS.infAmmo=true;
    const bot=e.combatants.find(c=>c.isBot&&c.alive);
    if(bot){
      check("practice: rules do not apply to bots", !Cheats.ammo(bot), "bot excluded");
      bot.setPrimary("ak47");bot.refillAmmo();
      const st=bot.slots[bot.curSlot];
      const before=st.mag;
      for(let i=0;i<3;i++){st.cd=0;WPN.fire(bot,1)}
      check("practice: bot ammo still drains", st.mag===before-3,
        `${st.mag}/${before}`);
    }
    SETTINGS.infAmmo=false;
  }

  Object.assign(SETTINGS,{takeover:saved.takeover,infAmmo:saved.ammo,
    infNades:saved.nades,infMoney:saved.money});
  M.phase=saved.phase; M.mode.roundPhase=saved.round;
  revive();
  return out;
}
