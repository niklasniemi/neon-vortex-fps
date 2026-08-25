// Buy window, economy, regeneration and weapon behaviour.
//   import('/tests/gameplay.test.js').then(m=>console.table(m.run()))
import {armourSplit,WEAPONS} from '/src/game/weapons.js';
import {applyBuy,buyBlocked} from '/src/game/economy.js';
import {REGEN,ECONOMY} from '/src/core/config.js';

const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

export function run(){
  out.length=0;
  const e=window.engine, p=e.player, M=window.NV.MATCH, m=M.mode;
  // Buying and regeneration both require a live player; make that explicit so
  // the suite does not depend on what ran before it.
  p.alive=true; p.health=100; p.protectT=0;
  const save={phase:m.roundPhase,buyT:m.buyT,mbuyT:M.buyT,money:p.money,armour:p.armour,
              helmet:p.helmet,left:p.leftSpawn,hurt:p.hurtT,pos:p.body.position.clone()};

  // ------------------------------------------------------------- buy window --
  m.roundPhase="freeze";
  check("buy: open during freeze time", M.canBuy(p)===true, "freeze");

  // MATCH.buyT is authoritative; mode.buyT is the mirrored copy the HUD reads.
  m.roundPhase="live"; M.buyT=8; m.buyT=8; p.leftSpawn=false;
  check("buy: still open in the first seconds of the round", M.canBuy(p)===true, "buyT=8");

  // Past the timer but still standing in spawn, unmoved -> the rule asked for.
  M.buyT=0; m.buyT=0; p.leftSpawn=false;
  p.body.position.copy(window.NV.WORLD.spawns[p.team][0].p);
  check("buy: open in spawn after the timer if you have not moved",
        M.canBuy(p)===true, "in spawn, leftSpawn=false");

  // Walk out of spawn -> latched shut.
  M.trackSpawnExit(p);
  p.body.position.set(0,p.body.position.y,0);   // mid
  M.trackSpawnExit(p);
  check("buy: closes once you leave spawn", M.canBuy(p)===false,
        `leftSpawn=${p.leftSpawn}`);

  // Returning to spawn does NOT reopen it.
  p.body.position.copy(window.NV.WORLD.spawns[p.team][0].p);
  check("buy: walking back to spawn does not reopen it", M.canBuy(p)===false, "stays latched");

  m.roundPhase="post";
  check("buy: closed between rounds", M.canBuy(p)===false, "post");

  // ------------------------------------------------------------- purchases --
  m.roundPhase="freeze"; p.leftSpawn=false;
  p.money=1000; p.armour=0; p.helmet=false;
  const bought=applyBuy(p,"kevlar_helmet");
  check("buy: kevlar+helmet takes the money and fits the armour",
        bought&&p.money===0&&p.armour===100&&p.helmet===true,
        `money ${p.money}, armour ${p.armour}, helmet ${p.helmet}`);

  // Use the player's OWN team rifle, or the team check masks the funds check.
  const myRifle=p.team===1?"m4a1":"ak47";
  p.money=100; p.slots[0].id=null; p.slots[0].cfg=null;
  check("buy: cannot afford your team's rifle",
        buyBlocked(p,myRifle)==="NO FUNDS", buyBlocked(p,myRifle));

  p.money=5000;
  const wrongTeam=p.team===1?"ak47":"m4a1";
  check("buy: other side's rifle is unavailable",
        !!buyBlocked(p,wrongTeam), buyBlocked(p,wrongTeam)||"allowed!");

  const ownTeam=p.team===1?"m4a1":"ak47";
  p.money=5000;
  applyBuy(p,ownTeam);
  check("buy: own rifle equips into the primary slot",
        p.slots[0].id===ownTeam&&p.slots[0].mag===WEAPONS[ownTeam].mag,
        `slot0=${p.slots[0].id} mag=${p.slots[0].mag}`);

  p.money=5000;
  p.nades={he:0,flash:0,smoke:0,molotov:0};
  applyBuy(p,"flash"); applyBuy(p,"flash");
  const third=applyBuy(p,"flash");
  check("buy: flashbangs cap at two", p.nades.flash===2&&!third, `flash=${p.nades.flash}`);

  // ------------------------------------------------------------ regeneration --
  p.health=40; p.armour=30; p.hurtT=e.time;             // just took a hit
  p.regen(1.0);
  check("regen: nothing regenerates right after damage",
        p.health===40&&p.armour===30, `hp ${p.health} armour ${p.armour}`);

  p.hurtT=e.time-(REGEN.delay+1);                       // long lull
  p.regen(1.0);
  check("regen: health never regenerates", p.health===40, `hp ${p.health}`);
  check("regen: armour trickles back slowly",
        Math.abs(p.armour-(30+REGEN.rate))<0.01,
        `${REGEN.rate}/s -> armour ${p.armour.toFixed(1)}`);
  check("regen: rate is far below the old 22/s", REGEN.rate<8, `${REGEN.rate}/s after ${REGEN.delay}s`);

  // ---------------------------------------------------------- armour model --
  {
    const ak=WEAPONS.ak47;
    const bare=armourSplit(ak.damage,ak,0,false,false);
    const vest=armourSplit(ak.damage,ak,100,false,false);
    check("armour: a vest reduces incoming damage",
          vest.health<bare.health,
          `${bare.health.toFixed(1)} -> ${vest.health.toFixed(1)}`);
    check("armour: absorbs and degrades", vest.armour>0, `armour lost ${vest.armour.toFixed(1)}`);

    const headNoHelm=armourSplit(ak.damage*ak.headMult,ak,100,false,true);
    check("armour: a vest alone does not protect the head",
          headNoHelm.health===ak.damage*ak.headMult, `${headNoHelm.health.toFixed(0)} dmg`);
    check("armour: AK headshot kills through a vest",
          headNoHelm.health>=100, `${headNoHelm.health.toFixed(0)} vs 100hp`);

    const headHelm=armourSplit(ak.damage*ak.headMult,ak,100,true,true);
    check("armour: a helmet blunts the headshot",
          headHelm.health<headNoHelm.health, `${headHelm.health.toFixed(0)} with helmet`);
  }

  // --------------------------------------------------------------- weapons --
  {
    const ids=Object.keys(WEAPONS);
    const noVm=ids.filter(id=>typeof WEAPONS[id].vm!=="function");
    check("weapons: every gun has a view model", noVm.length===0, noVm.join(",")||"all present");

    const bad=ids.filter(id=>{
      const w=WEAPONS[id];
      return !(w.fireRate>0)||!(w.mag>0)||!(w.damage>0)||!w.snd||!(w.range>0);
    });
    check("weapons: all stats are complete", bad.length===0, bad.join(",")||"all valid");

    const legacy=ids.filter(id=>/plasma|railgun|vortex|cyber|graviton/.test(id));
    check("weapons: no arcade weapons remain", legacy.length===0, legacy.join(",")||"clean");

    const proj=ids.filter(id=>WEAPONS[id].classType==="projectile"||WEAPONS[id].classType==="sticky"||WEAPONS[id].classType==="charge");
    check("weapons: no broken projectile classes left", proj.length===0, proj.join(",")||"hitscan + melee only");

    const sprayGuns=ids.filter(id=>WEAPONS[id].pattern);
    check("weapons: rifles have learnable spray patterns", sprayGuns.length>=2, sprayGuns.join(","));
  }

  // restore
  m.roundPhase=save.phase; m.buyT=save.buyT; M.buyT=save.mbuyT;
  p.money=save.money; p.armour=save.armour; p.helmet=save.helmet;
  p.leftSpawn=save.left; p.hurtT=save.hurt; p.health=100;
  p.body.position.copy(save.pos);
  return out;
}
