// Live-fire check: every weapon must actually put damage on a target.
//   import('/tests/firing.test.js').then(m=>console.table(m.run()))
import {WEAPONS} from '/src/game/weapons.js';
import {WPN} from '/src/game/wpnsystem.js';

const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

export function run(){
  out.length=0;
  const e=window.engine, p=e.player, V=window.NV, SF=V.WORLD.spans;
  const m=V.MATCH.mode;
  const savePhase=m.roundPhase;
  m.roundPhase="live";

  const foe=e.combatants.find(c=>c.isBot&&c.team!==p.team);
  if(!foe){check("firing: found a target",false,"no enemy bot");return out}

  // Open ground with headroom, so nothing occludes the shot.
  let spot=null;
  for(let x=-18;x<18&&!spot;x+=1)for(let z=-18;z<18;z+=1){
    const a=SF.spanAt(x,z,SF.groundFloorAt(x,z)+.1,.35);
    const b=SF.spanAt(x,z+5,SF.groundFloorAt(x,z+5)+.1,.35);
    if(a&&b&&a.ceil-a.floor>4&&b.ceil-b.floor>4&&Math.abs(a.floor-b.floor)<.5){spot=[x,z,a.floor];break}
  }
  if(!spot){check("firing: found open ground",false,"none");return out}
  const [sx,sz,fy]=spot;

  const aim=()=>{
    p.body.position.set(sx,fy+0.42,sz);
    p.yaw=Math.PI; p.pitch=0; p.crouchAmt=0;
    p.body.velocity.set(0,0,0);
    p.groundedInfo={grounded:true,ny:1,surf:"concrete"};
    foe.body.position.set(sx,fy+0.42,sz+5);
    foe.alive=true; foe.health=100; foe.armour=0; foe.helmet=false; foe.protectT=0;
    foe.visYaw=0;
    if(foe.syncHitRoot)foe.syncHitRoot();
    // Camera drives aim for the local player.
    const eye=p.eyePos(new THREE.Vector3());
    V.GFX.camera.position.copy(eye);
    V.GFX.camera.rotation.set(0,Math.PI,0,"YXZ");
    V.GFX.camera.updateMatrixWorld(true);
  };

  const testable=Object.keys(WEAPONS).filter(id=>WEAPONS[id].classType==="hitscan");
  for(const id of testable){
    aim();
    // Force the weapon into the primary slot with a full magazine.
    const w=WEAPONS[id];
    p.slots[0].id=id; p.slots[0].cfg=w;
    p.slots[0].mag=w.mag; p.slots[0].reserve=w.reserve;
    p.slots[0].cd=0; p.slots[0].reloading=0; p.slots[0].bloom=0; p.slots[0].shotIdx=0;
    p.curSlot=0; p.pendingSlot=-1; p.switchAnim=0; p.adsAmt=1;

    const before=foe.health;
    let shots=0;
    for(let i=0;i<6&&foe.health>0;i++){
      p.slots[0].cd=0;
      p.slots[0].bloom=0;
      if(WPN.fire(p,1))shots++;
    }
    const dealt=before-foe.health;
    check(`fire: ${w.name} deals damage`, dealt>0, `${shots} shots -> ${dealt.toFixed(0)} dmg`);
  }

  // Knife needs to be in range.
  {
    aim();
    foe.body.position.set(sx,fy+0.42,sz+0.9);
    if(foe.syncHitRoot)foe.syncHitRoot();
    const w=WEAPONS.knife;
    p.slots[0].id="knife"; p.slots[0].cfg=w; p.slots[0].mag=1; p.slots[0].cd=0; p.slots[0].reloading=0;
    const before=foe.health;
    WPN.fire(p,1);
    check("fire: KNIFE deals damage", before-foe.health>0, `${(before-foe.health).toFixed(0)} dmg`);
  }

  // Ammo actually decrements and a magazine runs dry.
  {
    aim();
    const w=WEAPONS.mp9;
    p.slots[0].id="mp9"; p.slots[0].cfg=w; p.slots[0].mag=3; p.slots[0].reserve=30;
    p.slots[0].cd=0; p.slots[0].reloading=0;
    let fired=0;
    for(let i=0;i<6;i++){p.slots[0].cd=0;if(WPN.fire(p,1))fired++}
    check("fire: magazine empties and blocks further shots",
          fired===3&&p.slots[0].mag===0, `${fired} shots from a 3-round mag`);
  }

  // Movement penalty must actually widen the cone.
  {
    p.body.velocity.set(0,0,0);
    p.groundedInfo={grounded:true};
    const still=WPN.movementPenalty(p);
    p.body.velocity.set(1.63,0,0);
    const running=WPN.movementPenalty(p);
    p.groundedInfo={grounded:false};
    const jumping=WPN.movementPenalty(p);
    check("fire: running is less accurate than standing", running>still*1.5,
          `still ${still.toFixed(2)} vs running ${running.toFixed(2)}`);
    check("fire: jumping is heavily penalised", jumping>running*2,
          `jumping ${jumping.toFixed(2)}`);
    p.body.velocity.set(0,0,0);
    p.groundedInfo={grounded:true};
  }

  m.roundPhase=savePhase;
  foe.health=100;
  return out;
}
