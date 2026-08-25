// Wall-penetration probe.
//   import('/tests/walls.test.js').then(m=>m.run()).then(r=>console.log(JSON.stringify(r,null,1)))
//
// Runs every bot on real navigation for a while and reports any frame where the
// body ends up somewhere it should not be, plus whether the move between two
// consecutive frames crossed a solid surface.
const DT=1/60;

function probe(seconds=14){
  const e=window.engine, V=window.NV, SF=V.WORLD.spans, M=V.MATCH;
  const savedPhase=M.phase, savedRound=M.mode.roundPhase;
  M.phase="live"; M.mode.roundPhase="live"; M.roundPhase="live";

  const bots=e.combatants.filter(c=>c.isBot);
  for(const b of bots){b.alive=true;b.health=100;b.blindT=0;b.target=null;b.memory=0}

  const prev=new Map();
  for(const b of bots)prev.set(b,b.body.position.clone());

  const rc=new THREE.Raycaster();
  const SAMPLE_EVERY=4;
  let offMesh=0, crossings=0, sunk=0, worstSink=0, meshCrossings=0;
  const meshSamples=[];
  const samples=[];
  const frames=Math.round(seconds*60);

  for(let i=0;i<frames;i++){
    e.time+=DT;
    for(const b of bots){
      if(!b.alive)continue;
      b.update(DT);
    }
    for(const b of bots){
      if(!b.alive)continue;
      const p=b.body.position;
      const from=prev.get(b);
      const feet=p.y-0.42;

      // 1. Is the body somewhere with no floor at all?
      const span=SF.spanAt(p.x,p.z,feet+0.05,0.35);
      if(!span){
        offMesh++;
        if(samples.length<12)samples.push({kind:"off-mesh",bot:b.name,
          at:[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)]});
      }else{
        // Ground smoothing places the body between neighbouring cell floors,
        // so a small offset is expected. Anything deep is the body in the floor.
        const sink=span.floor-feet;
        if(sink>0.24){sunk++;if(sink>worstSink)worstSink=sink}
      }

      // 2. Did this frame's movement pass THROUGH a solid surface?
      // Two probes. The span check is cheap and catches blocked cells. The mesh
      // raycast is sampled every few frames and catches thin or single-sided
      // geometry that never registers in the span field at all -- which is the
      // only way a wall can be missing from it.
      const dx=p.x-from.x, dz=p.z-from.z;
      const dist=Math.hypot(dx,dz);
      if(dist>0.001){
        const steps=Math.max(2,Math.ceil(dist/0.12));
        for(let k=1;k<steps;k++){
          const t=k/steps;
          const mx=from.x+dx*t, mz=from.z+dz*t;
          const mfeet=(from.y+(p.y-from.y)*t)-0.42;
          if(!SF.fits(mx,mz,mfeet,1.38,0.35)){
            crossings++;
            if(samples.length<12)samples.push({kind:"crossed-blocked-cell",bot:b.name,
              from:[+from.x.toFixed(2),+from.z.toFixed(2)],
              to:[+p.x.toFixed(2),+p.z.toFixed(2)],step:+dist.toFixed(3)});
            break;
          }
        }
        if((i%SAMPLE_EVERY)===0){
          const dir=new THREE.Vector3(dx/dist,0,dz/dist);
          // Sample above step height only: a kerb or stair riser is a vertical
          // face too, and walking over one is correct, not a wall crossing.
          for(const hh of [0.55,0.95,1.25]){
            rc.set(new THREE.Vector3(from.x,from.y-0.42+hh,from.z),dir);
            rc.far=dist+0.02;
            const hits=rc.intersectObjects(V.PHYS.colliders,false);
            let hit=null;
            for(const h of hits){
              if(!h.face)continue;
              const n=h.face.normal.clone().transformDirection(h.object.matrixWorld);
              if(Math.abs(n.y)>0.55)continue;
              hit=h;break;
            }
            if(hit){
              meshCrossings++;
              if(meshSamples.length<10)meshSamples.push({bot:b.name,height:hh,
                at:[+hit.point.x.toFixed(2),+hit.point.y.toFixed(2),+hit.point.z.toFixed(2)],
                step:+dist.toFixed(3),
                mesh:hit.object.name||"(unnamed)",
                spanSaysOk:!!SF.fits(p.x,p.z,p.y-0.42,1.38,0.35)});
              break;
            }
          }
        }
      }
      from.copy(p);
    }
  }

  M.phase=savedPhase; M.mode.roundPhase=savedRound;
  const botFrames=frames*bots.length;
  return {
    bots:bots.length,
    seconds,
    botFrames,
    offMeshFrames:offMesh,
    wallCrossings:crossings,
    meshWallCrossings:meshCrossings,
    meshSamples,
    meshChecksPerBot:Math.round(frames/SAMPLE_EVERY),
    sunkFrames:sunk,
    worstSink:+worstSink.toFixed(3),
    samples
  };
}

/** Standard suite wrapper so tests/all.js can run this like the others. */
export {probe as run};
export function runChecks(){
  const r=probe(6);
  const out=[];
  const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});
  check("walls: bots were available to test",r.bots>0,`${r.bots} bots, ${r.botFrames} bot-frames`);
  check("walls: nobody falls out of the world",r.offMeshFrames===0,
    `${r.offMeshFrames} off-mesh frames`);
  check("walls: nobody walks through a blocked cell",r.wallCrossings===0,
    `${r.wallCrossings} crossings`);
  // Hollow shell meshes (all-vertical, no top or bottom face) are invisible to
  // the span field, so this probe is the only thing that catches them.
  check("walls: nobody walks through a wall mesh",r.meshWallCrossings===0,
    r.meshWallCrossings?JSON.stringify(r.meshSamples[0]):`${r.meshChecksPerBot} sampled steps per bot, clean`);
  check("walls: nobody sinks into the floor",r.sunkFrames===0,
    `worst ${r.worstSink}m (tolerance 0.24m for grid interpolation)`);
  return out;
}
