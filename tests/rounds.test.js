// Round flow: plant, defuse, fuse, economy and half-time.
//   import('/tests/rounds.test.js').then(m=>console.table(m.run()))
import {ECONOMY} from '/src/core/config.js';

const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

export function run(){
  out.length=0;
  const e=window.engine, V=window.NV, M=V.MATCH, md=M.mode, SF=V.WORLD.spans;

  // --- round setup ---------------------------------------------------------
  // startMatch already ran round 1, so calling startRound again would land on
  // round 2. Rewind so the pistol-round economy checks below are meaningful.
  M.round=0;
  let err=null;
  try{ md.startRound(M) }catch(ex){ err=ex.message }
  check("round: counter advanced to the pistol round", M.round===1, `round ${M.round}`);
  check("round: starts without throwing", err===null, err||"clean");

  check("round: a carrier is assigned", !!M.carrier,
    M.carrier?`${M.carrier.name} (T)`:"none");
  check("round: the carrier is a terrorist", !M.carrier||M.carrier.team===2,
    M.carrier?`team ${M.carrier.team}`:"n/a");
  check("round: the carrier actually holds the bomb", !!(M.carrier&&M.carrier.hasBomb),
    M.carrier?String(!!M.carrier.hasBomb):"n/a");

  check("round: opens in freeze with a buy window",
    M.roundPhase==="freeze"&&M.buyT>0,
    `${M.roundPhase}, buy ${Math.round(M.buyT)}s`);
  check("round: freeze is 15s, buy window 20s",
    Math.round(M.phaseT)===15&&Math.round(M.buyT)===20,
    `freeze ${Math.round(M.phaseT)}s / buy ${Math.round(M.buyT)}s`);

  // --- roles ---------------------------------------------------------------
  {
    const bots=e.combatants.filter(c=>c.isBot&&c.alive);
    const ts=bots.filter(b=>b.team===2).map(b=>b.objRole);
    const cts=bots.filter(b=>b.team===1).map(b=>b.objRole);
    check("roles: terrorists get a mix of jobs", new Set(ts).size>1, ts.join(","));
    check("roles: a planter is nominated", ts.includes("plant")||!!M.carrier, ts.join(","));
    check("roles: CT fields a mid roamer", cts.includes("roam"), cts.join(","));
    check("roles: CT splits between both sites",
      cts.includes("holdA")&&cts.includes("holdB"), cts.join(","));
  }

  // --- pistol round economy ------------------------------------------------
  {
    const bots=e.combatants.filter(c=>c.isBot&&c.alive);
    const primaries=bots.filter(b=>b.slots[0]&&b.slots[0].cfg);
    check("economy: no rifles on the pistol round", primaries.length===0,
      primaries.length?primaries.map(b=>b.slots[0].id).join(","):"pistols only");
    const sidearms=bots.map(b=>b.slots[1]&&b.slots[1].id);
    const ctOk=bots.filter(b=>b.team===1).every(b=>b.slots[1].id==="usp");
    const tOk =bots.filter(b=>b.team===2).every(b=>b.slots[1].id==="glock");
    check("economy: teams get their own sidearm", ctOk&&tOk,
      `CT usp:${ctOk} / T glock:${tOk}`);
  }

  // --- planting ------------------------------------------------------------
  {
    const site=V.WORLD.def.sites[0];
    const carrier=M.carrier;
    if(!carrier){check("plant: carrier available",false,"none")}
    else{
      const f=SF.groundFloorAt(site.x,site.z);
      carrier.body.position.set(site.x,f+0.42,site.z);
      check("plant: the site footprint is detected",
        !!md.siteAt(carrier.body.position),
        md.siteAt(carrier.body.position)?`inside ${site.name}`:"not registering");

      // Somewhere well outside both sites should NOT register.
      const away=new THREE.Vector3(site.x+40,f,site.z+40);
      check("plant: outside the site does not register", !md.siteAt(away), "correctly rejected");
    }
  }

  // --- fuse and defuse timings --------------------------------------------
  check("bomb: 40 second fuse", md.bombTime===40, `${md.bombTime}s`);
  check("bomb: plant takes about 3 seconds", md.plantTime>2.5&&md.plantTime<4,
    `${md.plantTime}s`);
  check("bomb: defuse takes 5 seconds", md.defuseTime===5, `${md.defuseTime}s`);

  // --- payouts -------------------------------------------------------------
  {
    // Reset the streak and wallets so the payout is measured from a known
    // baseline -- money is capped, and a stale loss streak changes the numbers.
    M.lossStreak={1:0,2:0};
    for(const c of e.combatants)c.money=1000;
    const before=e.combatants.map(c=>({c,m:c.money,team:c.team}));
    const savedPhase=M.roundPhase, savedScores={...M.scores};
    // endRound refuses to run once the match is over, and awarding rounds here
    // would eventually push the score past roundsToWin and end it. Rewind
    // first, and put everything back afterwards.
    M.scores.t1=0;M.scores.t2=0;M.endPending=false;M.roundPhase="live";
    md.endRound(M,"t1","TEST");
    const winners=before.filter(b=>b.team===1);
    const losers=before.filter(b=>b.team===2);
    const wOk=winners.every(b=>b.c.money>b.m);
    const lOk=losers.every(b=>b.c.money>b.m);
    check("economy: winners are paid", wOk,
      winners.length?`+${(winners[0].c.money-winners[0].m)}`:"n/a");
    check("economy: losers get a consolation bonus", lOk,
      losers.length?`+${(losers[0].c.money-losers[0].m)}`:"n/a");
    // A win pays the flat 3250. The loss bonus starts lower but escalates with
    // each consecutive defeat and eventually exceeds it -- that is how CS keeps
    // a losing team able to re-buy, so this checks the first-loss case only.
    check("economy: a first loss pays less than a win",
      !winners.length||!losers.length||
      (winners[0].c.money-winners[0].m)>(losers[0].c.money-losers[0].m),
      `win +${winners.length?winners[0].c.money-winners[0].m:0} vs loss +${losers.length?losers[0].c.money-losers[0].m:0}`);
    check("economy: win payout matches the CS figure",
      !winners.length||(winners[0].c.money-winners[0].m)===ECONOMY.winRound,
      `+${winners.length?winners[0].c.money-winners[0].m:0} (expected ${ECONOMY.winRound})`);
    check("economy: the round was scored", M.scores.t1===1, `CT ${M.scores.t1}`);
    check("economy: money is capped", e.combatants.every(c=>c.money<=ECONOMY.maxMoney),
      `cap ${ECONOMY.maxMoney}`);
    // Restore, so running this suite twice in one session behaves the same way.
    M.scores.t1=savedScores.t1;M.scores.t2=savedScores.t2;
    M.roundPhase=savedPhase;M.endPending=false;
  }

  return out;
}
