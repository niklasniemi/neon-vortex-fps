// Bot behaviour: navigation, movement, target acquisition, round roles.
//   import('/tests/bots.test.js').then(m=>console.table(m.run()))
const DT=1/60;
const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

export function run(){
  out.length=0;
  const e=window.engine, V=window.NV, SF=V.WORLD.spans, M=V.MATCH;
  const bots=e.combatants.filter(c=>c.isBot);
  // Bots are deliberately frozen during buy time; take the round live so the
  // movement and engagement checks measure the AI rather than the freeze rule.
  // Two separate gates: Bot.update() checks MATCH.phase, and the buy rules
  // check roundPhase. Both have to be live or the AI simply stands still.
  const savedPhase=M.mode.roundPhase, savedMatchPhase=M.phase;
  // Snapshot now: the engagement test below can kill the bomb carrier, and a
  // dead carrier correctly drops the bomb and clears MATCH.carrier.
  const carrierAtStart=M.carrier||M.mode.carrier;
  M.mode.roundPhase="live"; M.roundPhase="live"; M.phase="live";

  check("bots: roster was populated", bots.length>0, `${bots.length} bots`);
  if(!bots.length)return out;

  check("bots: split across both teams",
    bots.some(b=>b.team===1)&&bots.some(b=>b.team===2),
    `CT ${bots.filter(b=>b.team===1).length} / T ${bots.filter(b=>b.team===2).length}`);

  // --- nav graph -----------------------------------------------------------
  check("nav: graph was generated", V.BOTMAN.nodes&&V.BOTMAN.nodes.length>50,
    `${V.BOTMAN.nodes?V.BOTMAN.nodes.length:0} nodes`);

  const linked=V.BOTMAN.nodes.filter(n=>n.links&&n.links.length>0);
  check("nav: nodes are connected", linked.length>V.BOTMAN.nodes.length*0.8,
    `${linked.length}/${V.BOTMAN.nodes.length} have links`);

  const hot=V.BOTMAN.nodes.filter(n=>n.flags&&n.flags.hot);
  check("nav: bombsites and mid are flagged hot", hot.length>0, `${hot.length} hot nodes`);

  // A* must find a route between the two spawns.
  {
    const a=V.WORLD.spawns[1][0].p, b=V.WORLD.spawns[2][0].p;
    const path=V.BOTMAN.findPath(a,b);
    check("nav: routes across the map", !!path&&path.length>3,
      path?`${path.length} waypoints CT spawn -> T spawn`:"no path");
  }

  // --- movement ------------------------------------------------------------
  {
    // In bomb mode the AI runs defusalBrain(), which steers toward objPoint and
    // ignores any path you hand it. So give it a distant objective and watch it
    // close the gap -- that is the behaviour that actually ships.
    const b=bots.find(x=>x.alive)||bots[0];
    b.alive=true;b.health=100;b.blindT=0;b.target=null;b.memory=0;
    b.path=null;b.pathI=0;b.repathT=0;b.stuckT=0;
    // defusalBrain drops everything to fight when it sees an enemy, so the walk
    // would sometimes measure an engagement instead. Take the others off the
    // board for the duration.
    const hidden=[];
    for(const o of e.combatants){
      if(o===b||!o.alive)continue;
      hidden.push(o);o.alive=false;
    }

    // Pick a goal in the bot's own graph component. The navmesh legitimately
    // contains islands -- ledges reachable only by jumping -- and sending it to
    // one measures the map rather than the AI.
    const here=b.body.position.clone();
    const B=V.BOTMAN;
    const comp=B.mainComponent;
    const myComp=comp?comp[B.nodes.indexOf(B.nearestNode(here))]:null;
    let far=null,farD=0;
    for(let i=0;i<B.nodes.length;i++){
      if(comp&&comp[i]!==myComp)continue;
      const d=B.nodes[i].p.distanceTo(here);
      if(d>farD&&d<26){farD=d;far=B.nodes[i]}
    }
    b.objRole="escort";
    b.objPoint=far?far.p.clone():null;

    const startD=b.objPoint?b.body.position.distanceTo(b.objPoint):0;
    for(let i=0;i<1200;i++){ e.time+=DT; b.update(DT); }
    const endD=b.objPoint?b.body.position.distanceTo(b.objPoint):0;
    const closed=startD-endD;

    for(const o of hidden)o.alive=true;
    check("bots: walk toward their objective", closed>startD*0.5,
      `closed ${closed.toFixed(1)}m of ${startD.toFixed(1)}m in 20s`);

    const feet=b.body.position.y-0.42;
    const span=SF.spanAt(b.body.position.x,b.body.position.z,feet+0.05,0.35);
    check("bots: stay on the navmesh while moving", !!span,
      span?`standing on floor ${span.floor.toFixed(2)}`:"ended off-mesh");
  }

  // --- target acquisition and engagement -----------------------------------
  {
    const ct=bots.find(b=>b.team===1), t=bots.find(b=>b.team===2);
    if(!ct||!t){check("bots: both sides present for an engagement test",false,"missing a side")}
    else{
      // Same storey, clear line, inside the rifle's preferred engagement band.
      let spot=null;
      for(let x=-16;x<16&&!spot;x+=1)for(let z=-16;z<16;z+=1){
        const s1=SF.spanAt(x,z,SF.groundFloorAt(x,z)+.1,.35);
        const s2=SF.spanAt(x,z+10,SF.groundFloorAt(x,z+10)+.1,.35);
        if(s1&&s2&&s1.ceil-s1.floor>3&&s2.ceil-s2.floor>3&&Math.abs(s1.floor-s2.floor)<0.3){
          const a=new THREE.Vector3(x,s1.floor+1.0,z), b2=new THREE.Vector3(x,s2.floor+1.0,z+10);
          if(SF.losClear(a,b2))spot=[x,z,s1.floor,s2.floor];
        }
      }
      if(!spot){check("bots: found a clear firing lane",false,"none on this map")}
      else{
        const [x,z,f1,f2]=spot;
        for(const b of [ct,t]){
          b.alive=true;b.health=100;b.armour=0;b.helmet=false;
          b.protectT=0;b.blindT=0;
          b.target=null;b.memory=0;b.reactAt=0;
          b.path=null;b.pathI=0;b.repathT=0;b.stuckT=0;
          b.burstLeft=0;b.burstPauseT=0;
          b.switchAnim=0;b.pendingSlot=-1;b.nadeCd=0;
          b.crouchAmt=0;b.crouchF=0;b.strafeT=0;
          b.hasBomb=false;
          b.nades={he:0,flash:0,smoke:0,molotov:0};
        }
        ct.body.position.set(x,f1+0.42,z);
        t.body.position.set(x,f2+0.42,z+10);
        ct.syncHitRoot();t.syncHitRoot();
        ct.setPrimary("m4a1");t.setPrimary("ak47");
        ct.refillAmmo();t.refillAmmo();
        for(const b of [ct,t])for(const sl of b.slots){sl.cd=0;sl.reloading=0;sl.bloom=0}
        // Objective sits on top of them so defusalBrain does not walk them off.
        ct.objRole="holdA";ct.objPoint=ct.body.position.clone();
        t.objRole="escort"; t.objPoint=t.body.position.clone();

        let sawTarget=false, dealt=false, shots=0;
        const startHp=t.health;
        const ctPos=ct.body.position.clone(), tPos=t.body.position.clone();
        const origFire=V.WPN.fire.bind(V.WPN);
        V.WPN.fire=function(ent,r){if(ent===ct)shots++;return origFire(ent,r)};
        for(let i=0;i<900;i++){
          e.time+=DT;
          ct.update(DT); t.update(DT);
          // Pin them: ENGAGE strafes, and two bots circling drift out of the lane.
          ct.body.position.copy(ctPos); ct.body.velocity.set(0,0,0); ct.syncHitRoot();
          t.body.position.copy(tPos);   t.body.velocity.set(0,0,0); t.syncHitRoot();
          if(ct.target===t)sawTarget=true;
          if(t.health<startHp){dealt=true;break}
        }
        V.WPN.fire=origFire;
        check("bots: acquire an enemy in line of sight", sawTarget,
          sawTarget?"target locked":"never saw the enemy");
        check("bots: open fire and land hits", dealt,
          dealt?`${shots} shots -> target at ${t.health.toFixed(0)}hp`
               :`fired ${shots} shots, no hits in 15s`);
      }
    }
  }

  // --- round roles ---------------------------------------------------------
  {
    const roles={};
    for(const b of bots)if(b.objRole)roles[b.objRole]=(roles[b.objRole]||0)+1;
    check("bots: receive per-round objectives", Object.keys(roles).length>0, JSON.stringify(roles));

    const ts=bots.filter(b=>b.team===2);
    // Uses the snapshot taken before combat, for the reason noted above.
    // A carrier who dies drops the bomb and clears MATCH.carrier, which is
    // correct -- so accept either the snapshot or whoever now holds it.
    const carrier=carrierAtStart||M.carrier||e.combatants.find(c=>c.hasBomb);
    check("bots: a terrorist carries the bomb",
      !!carrier, carrier?`${carrier.name}`:"no carrier assigned");
    check("bots: the carrier is on the terrorist side",
      !carrier||carrier.team===2, carrier?`team ${carrier.team}`:"n/a");
    if(ts.length>1){
      check("bots: terrorists are not all given the same job",
        new Set(ts.map(b=>b.objRole)).size>1,
        ts.map(b=>b.objRole).join(","));
    }
  }

  // --- LOS honesty ---------------------------------------------------------
  {
    // A bot must not see through a wall. Sample pairs and confirm losClear
    // agrees with the span field.
    let disagreements=0,tested=0;
    for(let i=0;i<60;i++){
      const a=V.BOTMAN.randomNode(), b=V.BOTMAN.randomNode();
      if(!a||!b||a===b)continue;
      const p1=new THREE.Vector3(a.p.x,a.p.y+0.95,a.p.z);
      const p2=new THREE.Vector3(b.p.x,b.p.y+0.95,b.p.z);
      tested++;
      const spanSays=SF.losClear(p1,p2);
      const physSays=V.PHYS.losClear(p1,p2,null);
      if(physSays&&!spanSays)disagreements++;   // physics permissive where spans block
    }
    check("bots: line of sight respects geometry", disagreements===0,
      `${tested} sightlines, ${disagreements} would shoot through a wall`);
  }

  // --- vertical aim --------------------------------------------------------
  {
    const b=bots.find(x=>x.team===1)||bots[0];
    b.pitch=undefined;                       // simulate a fresh, unset bot
    b.faceAim(b.yaw, 0.6, 1.0, 10);          // ask for a steep upward angle
    check("bots: pitch stays a finite number", isFinite(b.pitch), String(b.pitch));
    check("bots: can aim vertically, not just level",
      Math.abs(b.pitch)>0.01, `pitch moved to ${Number(b.pitch).toFixed(3)}`);
    b.pitch=0;
  }

  M.mode.roundPhase=savedPhase; M.phase=savedMatchPhase;
  return out;
}
