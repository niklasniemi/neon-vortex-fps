// Manual-step physics harness.
//
// Load from the browser console after a match has started:
//   import('/tests/physics.test.js').then(m=>m.run()).then(r=>console.table(r))
//
// The engine's rAF loop does not tick when the tab is hidden, so this drives
// applyMove() directly at a fixed 60 Hz. That also makes the results
// deterministic, which is what you want from a regression check.
const DT=1/60;

function ctx(){
  const e=window.engine;
  if(!e||e.state!=="playing")throw new Error("start a match first");
  return {e,p:e.player,SF:window.NV.WORLD.spans,CFGfeet:0.42};
}

function place(p,SF,x,z){
  const f=SF.groundFloorAt(x,z);
  p.body.position.set(x,f+0.42,z);
  p.body.velocity.set(0,0,0);
  p.snapDown=true;p.crouchAmt=0;
  p.ctrl.mx=0;p.ctrl.mz=0;p.ctrl.jump=false;p.ctrl.crouch=false;p.ctrl.sprint=false;
  return f;
}

function step(e,p,n=1){
  for(let i=0;i<n;i++){e.time+=DT;p.applyMove(DT)}
}

const results=[];
const check=(name,pass,detail)=>results.push({test:name,result:pass?"PASS":"FAIL",detail});

export function run(){
  results.length=0;
  const {e,p,SF}=ctx();
  const origPos=p.body.position.clone();

  // ---------------------------------------------------------------- jump ---
  {
    // Find an outdoor cell with plenty of headroom so the ceiling does not
    // interfere with the arc measurement.
    let spot=null;
    for(let x=-24;x<24&&!spot;x+=1.5)for(let z=-24;z<24;z+=1.5){
      const s=SF.spanAt(x,z,SF.groundFloorAt(x,z)+0.1,0.35);
      if(s&&s.ceil-s.floor>6){spot=[x,z];break}
    }
    if(!spot)check("jump: found open ground",false,"no open cell");
    else{
      place(p,SF,spot[0],spot[1]);
      step(e,p,10);
      const g=p.body.position.y;
      p.doJump(p.groundedInfo);
      const tr=[];
      for(let i=0;i<200;i++){
        step(e,p);
        tr.push(p.body.position.y-g);
        if(i>3&&p.groundedInfo.grounded)break;
      }
      const peak=Math.max(...tr), pi=tr.indexOf(peak);
      const air=tr.length*DT;

      check("jump: reaches a usable height",peak>0.45&&peak<1.1,`peak ${peak.toFixed(3)}m`);
      check("jump: airtime feels floaty",air>0.7&&air<1.6,`${air.toFixed(2)}s aloft`);

      // The old bug: descent collapsed into one frame. Require the fall to be
      // spread over many frames with no single huge step.
      const desc=tr.slice(pi);
      let biggest=0;
      for(let i=1;i<desc.length;i++)biggest=Math.max(biggest,Math.abs(desc[i]-desc[i-1]));
      check("jump: descent is not a teleport",desc.length>12&&biggest<peak*0.45,
            `${desc.length} frames down, largest single step ${biggest.toFixed(3)}m`);
      check("jump: descent accelerates",
            Math.abs(desc[1]-desc[0])<Math.abs(desc[desc.length-1]-desc[desc.length-2]),
            "gravity is building over the fall");
      check("jump: lands back on the ground",Math.abs(tr[tr.length-1])<0.06,
            `ended ${tr[tr.length-1].toFixed(3)}m from start`);
    }
  }

  // --------------------------------------------------------------- walls ---
  {
    // Walk hard in eight directions from many start points; the body must
    // never end up inside geometry (no valid span at its feet).
    let tested=0,inside=0,worstPen=0;
    for(let a=0;a<8;a++){
      const ang=a/8*Math.PI*2;
      for(const [sx,sz] of [[-18.7,-15.3],[-20.5,18.9],[0,0],[23.5,7.1],[-17.5,-6.1]]){
        place(p,SF,sx,sz);
        step(e,p,5);
        p.ctrl.mz=1;
        p.yaw=ang;
        step(e,p,180);          // 3 seconds of running straight at whatever is there
        tested++;
        const feet=p.body.position.y-0.42;
        const s=SF.spanAt(p.body.position.x,p.body.position.z,feet+0.05,0.35);
        if(!s){inside++;continue}
        const pen=s.floor-feet;
        if(pen>worstPen)worstPen=pen;
      }
    }
    check("walls: never ends up inside geometry",inside===0,
          `${tested} runs, ${inside} ended off-mesh`);
    check("walls: never sinks into a floor",worstPen<0.4,
          `worst penetration ${worstPen.toFixed(3)}m`);
  }

  // ------------------------------------------------------------- ceilings ---
  {
    // Find a cell with a low ceiling and confirm a jump cannot pass through it.
    let low=null;
    for(let x=-24;x<24&&!low;x+=1)for(let z=-24;z<24;z+=1){
      const f=SF.groundFloorAt(x,z);
      if(f<-900)continue;
      const s=SF.spanAt(x,z,f+0.1,0.35);
      if(s&&isFinite(s.ceil)&&s.ceil-s.floor>1.6&&s.ceil-s.floor<3.2){low=[x,z,s];break}
    }
    if(!low)check("ceiling: found a covered cell",false,"none in range");
    else{
      const [x,z,s]=low;
      place(p,SF,x,z);
      step(e,p,6);
      p.doJump(p.groundedInfo);
      let maxHead=-Infinity;
      for(let i=0;i<120;i++){
        step(e,p);
        maxHead=Math.max(maxHead,p.body.position.y-0.42+1.38);
        if(i>3&&p.groundedInfo.grounded)break;
      }
      check("ceiling: head never passes the roof",maxHead<=s.ceil+0.02,
            `head reached ${maxHead.toFixed(2)}, ceiling ${s.ceil.toFixed(2)}`);
      check("ceiling: still allows a real hop",maxHead>s.floor+1.38+0.05,
            `clearance under a ${(s.ceil-s.floor).toFixed(2)}m ceiling`);
    }
  }

  // ------------------------------------------------------------ crouching ---
  {
    const f=SF.groundFloorAt(origPos.x,origPos.z);
    place(p,SF,origPos.x,origPos.z);
    step(e,p,5);
    p.ctrl.crouch=true;
    step(e,p,40);
    const crouched=p.crouchAmt;
    p.ctrl.crouch=false;
    step(e,p,40);
    check("crouch: engages and releases",crouched>0.9&&p.crouchAmt<0.1,
          `crouched to ${crouched.toFixed(2)}, stood back to ${p.crouchAmt.toFixed(2)}`);
  }

  // Restore: the wall trials deliberately run the player into geometry and can
  // leave them hurt or dead, which would poison any suite that runs after.
  p.body.position.copy(origPos);
  p.body.velocity.set(0,0,0);
  p.alive=true; p.health=100; p.hurtT=-99; p.protectT=0;
  p.crouchAmt=0; p.snapDown=true; p.leftSpawn=false;
  p.ctrl.mx=0; p.ctrl.mz=0; p.ctrl.jump=false; p.ctrl.crouch=false;
  return results;
}
