// Slope smoothness.
//   import('/tests/slope.test.js').then(m=>console.table(m.run()))
//
// Walks the player up and down every ramp it can find and measures vertical
// jerk -- the frame-to-frame change in vertical step. A staircase of grid cells
// shows up as periodic spikes; a smooth ramp does not.
const DT=1/60;
const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

/**
 * Finds the longest gradual slope on the map, scanning both axes.
 * "Gradual" matters: sampling only the endpoints happily accepts a 2m ledge,
 * which is a wall, not a hill -- and no controller should walk up one.
 */
function findRamp(SF,bounds){
  const RUN=6, STEP=0.25;
  const cands=[];
  const scan=(axis)=>{
    for(let a=bounds.minX+5;a<bounds.maxX-5;a+=1){
      for(let b=bounds.minZ+5;b<bounds.maxZ-RUN-2;b+=1){
        let last=null, rise=0, maxD=0, ok=true;
        for(let t=0;t<=RUN;t+=STEP){
          const x=axis==="z"?a:a+t, z=axis==="z"?b+t:b;
          const f=SF.groundFloorAt(x,z);
          if(f<-900){ok=false;break}
          const sp=SF.spanAt(x,z,f+0.1,0.35);
          if(!sp||sp.ceil-sp.floor<1.38){ok=false;break}
          if(last!==null){
            const d=f-last;
            if(Math.abs(d)>maxD)maxD=Math.abs(d);
            rise+=d;
          }
          last=f;
        }
        // maxD guards against a step masquerading as a slope.
        if(ok&&Math.abs(rise)>0.8&&maxD<=0.22)
          cands.push({axis,x:axis==="z"?a:a,z:axis==="z"?b:b,rise,maxD,run:RUN});
      }
    }
  };
  scan("z");scan("x");
  cands.sort((p,q)=>Math.abs(q.rise)-Math.abs(p.rise));
  return cands[0]||null;
}

export function run(){
  out.length=0;
  const e=window.engine, p=e.player, V=window.NV, SF=V.WORLD.spans, M=V.MATCH;
  const savedPhase=M.phase;
  M.phase="live"; M.mode.roundPhase="live";

  const ramp=findRamp(SF,V.WORLD.bounds);
  if(!ramp){check("slope: found a ramp to test",false,"none on this map");return out}
  check("slope: found a ramp to test",true,`${ramp.rise.toFixed(2)}m over ${ramp.run}m along ${ramp.axis} (max ${ramp.maxD.toFixed(3)}m per sample)`);

  const walk=(dir)=>{
    p.alive=true;p.health=100;p.crouchAmt=0;
    const alongZ=(ramp.axis==="z");
    const s0=dir>0?0:ramp.run;
    const sx=alongZ?ramp.x:ramp.x+s0;
    const sz=alongZ?ramp.z+s0:ramp.z;
    p.body.position.set(sx,SF.groundFloorAt(sx,sz)+0.42,sz);
    p.body.velocity.set(0,0,0);
    p.snapDown=true;
    // yaw such that ctrl.mz=1 drives along the ramp in `dir`
    p.yaw=alongZ ? (dir>0?Math.PI:0) : (dir>0?-Math.PI/2:Math.PI/2);
    p.ctrl.mx=0;p.ctrl.jump=false;p.ctrl.crouch=false;p.ctrl.sprint=false;
    const ys=[];
    const x0=p.body.position.x, z0=p.body.position.z;
    for(let i=0;i<260;i++){
      e.time+=DT;
      p.ctrl.mz=1;
      p.applyMove(DT);
      ys.push(p.body.position.y);
    }
    p.ctrl.mz=0;
    const travelled=Math.hypot(p.body.position.x-x0,p.body.position.z-z0);
    return {ys,travelled,climbed:p.body.position.y-ys[0]};
  };

  const analyse=(res,label)=>{
    const ys=res.ys;
    // Only look at frames where the body is actually climbing/descending.
    const steps=[];
    for(let i=1;i<ys.length;i++)steps.push(ys[i]-ys[i-1]);
    const moving=steps.filter(s=>Math.abs(s)>1e-5);
    if(moving.length<20)return {label,jerk:0,maxStep:0,frames:moving.length,
                                travelled:res.travelled,climbed:res.climbed};
    let maxJerk=0;
    for(let i=1;i<steps.length;i++){
      const j=Math.abs(steps[i]-steps[i-1]);
      if(j>maxJerk)maxJerk=j;
    }
    const maxStep=Math.max(...steps.map(Math.abs));
    return {label,jerk:maxJerk,maxStep,frames:moving.length,
            travelled:res.travelled,climbed:res.climbed};
  };

  const up=analyse(walk(1),"up");
  const down=analyse(walk(-1),"down");

  // A 0.35m grid staircase produces jerks on the order of the cell height
  // change. Smooth interpolation keeps each frame's vertical step small and
  // the change between frames smaller still.
  check("slope: the walk actually traverses the ramp",
    up.travelled>1.5&&Math.abs(up.climbed)>0.3,
    `moved ${up.travelled.toFixed(2)}m, height changed ${up.climbed.toFixed(2)}m over ${up.frames} frames`);
  check("slope: climbing is smooth, not stepped",
    up.jerk<0.05, `worst jerk ${up.jerk.toFixed(4)}m, largest step ${up.maxStep.toFixed(4)}m`);
  check("slope: descending is smooth, not stepped",
    down.jerk<0.05, `worst jerk ${down.jerk.toFixed(4)}m, largest step ${down.maxStep.toFixed(4)}m`);
  check("slope: no single frame jumps a whole cell",
    up.maxStep<0.12&&down.maxStep<0.12,
    `up ${up.maxStep.toFixed(4)}m / down ${down.maxStep.toFixed(4)}m per frame`);

  M.phase=savedPhase;
  p.ctrl.mz=0;
  return out;
}
