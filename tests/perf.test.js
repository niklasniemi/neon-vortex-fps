// Frame cost profiler.
//   import('/tests/perf.test.js').then(m=>m.run()).then(r=>console.log(JSON.stringify(r,null,1)))
//
// Counts raycasts and times the major systems over a simulated second, so a
// regression can be attributed rather than guessed at.
const DT=1/60;

export function run(seconds=2){
  const e=window.engine, V=window.NV, M=V.MATCH;
  const savedPhase=M.phase;
  M.phase="live"; M.mode.roundPhase="live";

  // --- count raycasts by wrapping the shared raycaster --------------------
  const rc=V.PHYS.raycaster;
  const origIntersect=rc.intersectObjects.bind(rc);
  let rayCalls=0, rayObjects=0;
  rc.intersectObjects=function(list,rec){
    rayCalls++; rayObjects+=list.length;
    return origIntersect(list,rec);
  };
  const origRayWall=V.PHYS.rayWall.bind(V.PHYS);
  let wallRays=0;
  V.PHYS.rayWall=function(o,d,l){wallRays++;return origRayWall(o,d,l)};
  const origLos=V.PHYS.losClear.bind(V.PHYS);
  let losCalls=0;
  V.PHYS.losClear=function(a,b,i){losCalls++;return origLos(a,b,i)};

  const frames=Math.round(seconds*60);
  const bots=e.combatants.filter(c=>c.isBot&&c.alive);
  const timings={botUpdate:0,playerMove:0,physStep:0,fx:0,ui:0,push:0};
  const t=(k,fn)=>{const s=performance.now();fn();timings[k]+=performance.now()-s};

  const wallStart=performance.now();
  for(let i=0;i<frames;i++){
    e.time+=DT;
    t("botUpdate",()=>{for(const b of bots)if(b.alive)b.update(DT)});
    t("playerMove",()=>{if(e.player.alive)e.player.applyMove(DT)});
    t("physStep",()=>V.PHYS.step(DT));
    t("fx",()=>V.FX.update(DT));
    t("ui",()=>V.UI.update(DT));
  }
  const wallMs=performance.now()-wallStart;

  rc.intersectObjects=origIntersect;
  V.PHYS.rayWall=origRayWall;
  V.PHYS.losClear=origLos;
  M.phase=savedPhase;

  // --- render cost --------------------------------------------------------
  // Measured separately: GPU work is asynchronous, so this is CPU submit time
  // plus whatever the driver blocks on.
  const G=V.GFX;
  const renderSamples=[];
  const shadowWas=G.renderer.shadowMap.enabled;
  const timeRender=(label,setup)=>{
    setup&&setup();
    // warm up, then measure
    for(let i=0;i<5;i++)G.render(DT);
    const s=performance.now();
    for(let i=0;i<20;i++)G.render(DT);
    renderSamples.push({label,ms:+((performance.now()-s)/20).toFixed(3)});
  };
  timeRender("full");
  timeRender("noShadows",()=>{G.renderer.shadowMap.enabled=false});
  G.renderer.shadowMap.enabled=shadowWas;
  const hadComposer=G.hasComposer;
  timeRender("noPost",()=>{G.hasComposer=false});
  G.hasComposer=hadComposer;
  timeRender("restored");

  const info=G.renderer.info;
  const perFrame=v=>+(v/frames).toFixed(3);
  return {
    frames, bots:bots.length,
    colliders:V.PHYS.colliders.length,
    msPerFrameTotal:+(wallMs/frames).toFixed(3),
    budget60fps:16.7,
    perFrame:{
      botUpdate:perFrame(timings.botUpdate),
      playerMove:perFrame(timings.playerMove),
      physStep:perFrame(timings.physStep),
      fx:perFrame(timings.fx),
      ui:perFrame(timings.ui)
    },
    render:renderSamples,
    scene:{
      drawCalls:info.render.calls,
      triangles:info.render.triangles,
      programs:info.programs?info.programs.length:0,
      shadowMap:G.lightRig?"on":"off",
      pixelRatio:G.renderer.getPixelRatio()
    },
    raycasts:{
      intersectCallsPerFrame:perFrame(rayCalls),
      objectsTestedPerFrame:Math.round(rayObjects/frames),
      rayWallPerFrame:perFrame(wallRays),
      losClearPerFrame:perFrame(losCalls)
    }
  };
}
