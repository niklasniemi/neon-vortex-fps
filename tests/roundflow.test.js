// Multi-round flow: rounds two and onward must behave like round one.
//   import('/tests/roundflow.test.js').then(m=>console.table(m.run()))
//
// The engine loop does not tick while the tab is hidden, so this drives
// MATCH.tick() directly at a fixed step and fast-forwards through whole rounds.
const DT=1/60;
const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

/** Steps the match clock until `pred` holds or `limit` seconds elapse. */
function advance(M,e,pred,limit=200){
  let t=0;
  while(t<limit){
    e.time+=DT; t+=DT;
    M.tick(DT);
    if(pred())return t;
  }
  return -1;
}

export function run(){
  out.length=0;
  const e=window.engine, M=window.NV.MATCH, md=M.mode;

  // Round 1 is already running from startMatch.
  check("round 1: opens in freeze", M.roundPhase==="freeze", M.roundPhase);
  check("round 1: clock is set", Math.round(M.roundT)===md.roundTime,
    `${Math.round(M.roundT)}s of ${md.roundTime}s`);

  const seen=[];
  for(let r=1;r<=4;r++){
    const roundAtStart=M.round;

    // freeze -> live
    const toLive=advance(M,e,()=>M.roundPhase==="live",60);
    if(toLive<0){check(`round ${r}: goes live`,false,`stuck in ${M.roundPhase}`);break}

    // The bug: the round ended within a frame or two of going live.
    const clockAtLive=M.roundT;
    let endedEarly=false;
    for(let i=0;i<120;i++){          // two seconds of live play
      e.time+=DT; M.tick(DT);
      if(M.roundPhase!=="live"){endedEarly=true;break}
    }
    seen.push({round:roundAtStart,clockAtLive:+clockAtLive.toFixed(1),
               survived2s:!endedEarly,phase:M.roundPhase});
    if(endedEarly)break;

    // Force this round to a conclusion so the next one starts.
    md.endRound(M,r%2?"t1":"t2","TEST");
    const toNext=advance(M,e,()=>M.roundPhase==="freeze"&&M.round===roundAtStart+1,40);
    if(toNext<0){check(`round ${r}: next round starts`,false,
      `phase ${M.roundPhase}, round ${M.round}`);break}
  }

  check("rounds do not end the instant they go live",
    seen.length>=3&&seen.every(s=>s.survived2s),
    JSON.stringify(seen));
  check("every round starts with a full clock",
    seen.every(s=>s.clockAtLive>md.roundTime-3),
    seen.map(s=>`r${s.round}:${s.clockAtLive}s`).join(" "));
  check("the round counter advances", M.round>=4, `reached round ${M.round}`);

  // Flanker rotation timing must be a real number, not NaN.
  {
    const flank=e.combatants.find(c=>c.isBot&&c.rotateAt!==undefined);
    check("bots get a valid rotation time",
      !flank||isFinite(flank.rotateAt),
      flank?String(flank.rotateAt):"no bots with a rotation time");
  }

  return out;
}
