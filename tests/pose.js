// Camera helpers for taking comparable screenshots.
//   import('/tests/pose.js').then(m=>m.vantage('A'))
export function ready(){
  const e=window.engine,V=window.NV;
  if(e.state!=="playing")return false;
  const p=e.player;
  p.alive=true;p.health=100;p.armour=100;p.helmet=true;p.hasDefuser=true;
  p.protectT=0;p.money=4200;
  p.setPrimary(p.team===1?"m4a1":"ak47");
  p.nades={he:1,flash:2,smoke:1,molotov:0};
  V.MATCH.mode.roundPhase="live";V.MATCH.phase="live";
  return true;
}

/** Stand at the nav node with the longest clear sightline to a landmark. */
export function vantage(which="A",minD=8,maxD=28){
  const e=window.engine,p=e.player,V=window.NV,SF=V.WORLD.spans;
  const d=V.WORLD.def;
  const site=which==="mid"
    ? {x:d.mid[0],z:d.mid[1]}
    : d.sites.find(s=>s.name===which)||d.sites[0];
  const ty=SF.groundFloorAt(site.x,site.z);
  const target=new THREE.Vector3(site.x,ty+1.0,site.z);
  let best=null,bestD=0;
  for(const n of V.WORLD.navDefs){
    const eye=new THREE.Vector3(n.p.x,n.p.y+0.95,n.p.z);
    const dist=eye.distanceTo(target);
    if(dist<minD||dist>maxD)continue;
    if(!SF.losClear(eye,target))continue;
    if(dist>bestD){bestD=dist;best=n}
  }
  if(!best)return "no vantage";
  p.body.position.set(best.p.x,best.p.y+0.42,best.p.z);
  p.body.velocity.set(0,0,0);p.snapDown=true;
  p.yaw=Math.atan2(-(site.x-best.p.x),-(site.z-best.p.z));
  p.pitch=-0.05;
  return `${which} from ${bestD.toFixed(1)}m at ${best.p.x.toFixed(1)},${best.p.z.toFixed(1)}`;
}

/** Drop a few bots into view so screenshots show combatants. */
export function gather(n=3){
  const e=window.engine,p=e.player,V=window.NV,SF=V.WORLD.spans;
  const fwd=new THREE.Vector3(-Math.sin(p.yaw),0,-Math.cos(p.yaw));
  const bots=e.combatants.filter(c=>c.isBot).slice(0,n);
  bots.forEach((b,i)=>{
    const d=7+i*3.5;
    const x=p.body.position.x+fwd.x*d+(i-1)*1.6;
    const z=p.body.position.z+fwd.z*d;
    const f=SF.groundFloorAt(x,z);
    if(f<-900)return;
    b.alive=true;b.health=100;
    b.body.position.set(x,f+0.42,z);
    b.visYaw=b.yaw=p.yaw+Math.PI;
    if(b.syncHitRoot)b.syncHitRoot();
  });
  return bots.length+" bots placed";
}
