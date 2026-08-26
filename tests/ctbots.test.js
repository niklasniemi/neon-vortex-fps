// Counter-terrorist behaviour: posts, rotation, and getting past walls.
//   import('/tests/ctbots.test.js').then(m=>console.table(m.run()))
const DT=1/60;
const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

export function run(){
  out.length=0;
  const e=window.engine, V=window.NV, M=V.MATCH, md=M.mode, SF=V.WORLD.spans;
  const savedPhase=M.phase, savedRound=md.roundPhase;
  M.phase="live"; md.roundPhase="live"; M.roundPhase="live";

  const cts=e.combatants.filter(c=>c.isBot&&c.team===1);
  check("ct: bots are on the board", cts.length>0, `${cts.length} CT bots`);
  if(!cts.length){M.phase=savedPhase;return out}

  // --- posts ---------------------------------------------------------------
  {
    const roles=cts.map(b=>b.objRole);
    const a=roles.filter(r=>r==="holdA").length;
    const b=roles.filter(r=>r==="holdB").length;
    const mid=roles.filter(r=>r==="roam").length;
    check("ct: both bombsites are covered", a>0&&b>0, `A ${a} / B ${b}`);
    check("ct: someone watches mid", mid>0, `${mid} roaming`);
    check("ct: the side is actually split", new Set(roles).size>=3,
      roles.join(","));
    check("ct: every bot has somewhere to be", cts.every(x=>!!x.objPoint),
      `${cts.filter(x=>x.objPoint).length}/${cts.length}`);
  }

  // --- walls ---------------------------------------------------------------
  {
    // walkableLine must reject a route that passes through solid geometry.
    const bot=cts[0];
    let blocked=null, open=null;
    for(let x=-22;x<22&&(!blocked||!open);x+=1){
      for(let z=-22;z<22;z+=1){
        const f=SF.groundFloorAt(x,z);
        if(f<-900)continue;
        const from=new THREE.Vector3(x,f+0.42,z);
        for(const d of [[6,0],[0,6],[-6,0],[0,-6]]){
          const tx=x+d[0], tz=z+d[1];
          const tf=SF.groundFloorAt(tx,tz);
          if(tf<-900)continue;
          const to=new THREE.Vector3(tx,tf+0.42,tz);
          bot.body.position.copy(from);
          const walk=bot.walkableLine(from,to);
          if(!walk&&!blocked)blocked={from,to};
          if(walk&&!open)open={from,to};
        }
      }
    }
    check("ct: a clear line is recognised as walkable", !!open, open?"found":"none");
    check("ct: a line through a wall is rejected", !!blocked, blocked?"found":"none");

    // With a wall in the way, the bot must path rather than walk into it.
    if(blocked){
      const b=cts[0];
      b.alive=true;b.health=100;b.target=null;b.memory=0;
      b.path=null;b.pathI=0;b.repathT=0;b.stuckT=0;
      b.body.position.copy(blocked.from);
      b.objRole="holdA";
      b.objPoint=blocked.to.clone();
      b.moveToward(b.objPoint,DT,1.1);
      check("ct: a blocked objective produces a path, not a straight line",
        !!(b.path&&b.path.length), b.path?`${b.path.length} waypoints`:"walked straight at it");
    }
  }

  // --- do they take up their posts? ---------------------------------------
  {
    // The question that matters in a match: with the whole side running, do CT
    // bots actually get from spawn to the positions they were assigned?
    for(const b of cts){
      b.alive=true;b.health=100;b.blindT=0;b.target=null;b.memory=0;
      b.path=null;b.pathI=0;b.repathT=0;b.stuckT=0;b.stuckRetries=0;
      b.progBest=undefined;b.progT=0;b.detourUntil=0;
    }
    // Enemies off the board so this measures navigation, not gunfights.
    const benched=[];
    for(const o of e.combatants){
      if(o.team!==1&&o.alive){benched.push(o);o.alive=false}
    }

    const startD=cts.map(b=>b.objPoint?b.body.position.distanceTo(b.objPoint):0);
    let blocked=0;
    const prev=cts.map(b=>b.body.position.clone());
    const FRAMES=1500;                        // 25 seconds
    for(let i=0;i<FRAMES;i++){
      e.time+=DT;
      for(const b of cts)if(b.alive)b.update(DT);
      cts.forEach((b,k)=>{
        if(b.body.position.distanceTo(prev[k])<DT*0.15&&(b.ctrl.mz||b.ctrl.mx))blocked++;
        prev[k].copy(b.body.position);
      });
    }
    const endD=cts.map(b=>b.objPoint?b.body.position.distanceTo(b.objPoint):0);
    for(const o of benched)o.alive=true;

    const atPost=endD.filter(d=>d<4).length;
    const closed=startD.map((d,k)=>d-endD[k]);
    // Bots start anywhere from a few metres to most of the map away, and posts
    // are assigned randomly, so how many have arrived at the 25s mark swings
    // between runs. The side's aggregate progress is the stable measure of
    // whether they can navigate.
    const totalStart=startD.reduce((a,b)=>a+b,0);
    const totalClosed=closed.reduce((a,b)=>a+b,0);
    // Threshold set to catch a regression, not to certify perfection: a broken
    // navigator closes ~0%, a working one 45-70% depending on where posts fell.
    check("ct: the side closes on its posts",
      totalClosed>totalStart*0.35,
      `${totalClosed.toFixed(0)}m of ${totalStart.toFixed(0)}m closed in 25s ` +
      `(${atPost}/${cts.length} arrived; ${endD.map(d=>d.toFixed(0)).join("/")}m remaining)`);
    check("ct: at least some bots take up position",
      atPost>=1, `${atPost}/${cts.length} within 4m`);
    check("ct: nobody walks away from their post",
      closed.every(c=>c>-4), closed.map(c=>c.toFixed(0)).join("/")+"m closed");
    check("ct: the side does not spend the round jammed",
      blocked<FRAMES*cts.length*0.15,
      `${blocked} blocked frames of ${FRAMES*cts.length}`);
  }

  // --- rotation on intel ---------------------------------------------------
  {
    const b=cts[0];
    const site=V.WORLD.def.sites[0];
    const post=b.objPoint?b.objPoint.clone():new THREE.Vector3();

    md.bombState="carried"; M.ctIntelPos=null; M.ctIntelT=0;
    const held=b.ctGoal(md);
    check("ct: holds its post with no information",
      !!held&&held.distanceTo(post)<0.01, "at post");

    M.ctIntelPos=new THREE.Vector3(site.x,0,site.z); M.ctIntelT=e.time+5;
    const rotating=b.ctGoal(md);
    check("ct: rotates to a spotted carrier",
      !!rotating&&rotating.distanceTo(M.ctIntelPos)<0.01, "moving to the sighting");

    M.ctIntelT=e.time-1;      // stale
    check("ct: stale information is dropped",
      b.ctGoal(md).distanceTo(post)<0.01, "back to post");

    md.bombState="planted";
    md.bombPos=new THREE.Vector3(site.x,0,site.z);
    const all=cts.map(x=>x.ctGoal(md));
    check("ct: every bot converges once the bomb is planted",
      all.every(g=>g&&g.distanceTo(md.bombPos)<0.01),
      `${all.length} bots on the bomb`);
    md.bombState="carried"; md.bombPos=null;
    M.ctIntelPos=null; M.ctIntelT=0;
  }

  M.phase=savedPhase; md.roundPhase=savedRound;
  return out;
}
