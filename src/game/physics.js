// Physics world, raycasting and area damage.
import {CFG,GRP} from '../core/config.js';
import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {WORLD,GFX,FX,AUDIO,engine} from '../core/globals.js';

export class PhysicsController{
  constructor(){
    this.world=new CANNON.World();
    this.world.broadphase=new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep=false;
    this.world.defaultContactMaterial.friction=0;
    this.world.defaultContactMaterial.restitution=0;
    this.raycaster=new THREE.Raycaster();
    this.colliders=[];
    this.removeQueue=[];
  }

  setGravity(g){this.world.gravity.set(0,g,0)}
  addBody(b){if(b&&b.kin)return;this.world.addBody(b)}
  removeBody(b){
    if(!b)return;
    if(this.removeQueue.includes(b))return;
    this.removeQueue.push(b);
  }

  step(dt){
    this.world.step(1/60,dt,4);
    if(this.removeQueue.length){
      const q=this.removeQueue.slice();
      this.removeQueue.length=0;
      for(const b of q){try{if(b.world)this.world.removeBody(b)}catch(e){}}
    }
  }

  /** Characters are kinematic: position is integrated by the controller. */
  makeChar(pos){
    return {position:pos.clone(),velocity:new THREE.Vector3(),mass:80,kin:true,userData:{type:"char"}};
  }

  ground(body){
    const SF=WORLD&&WORLD.spans;
    if(!SF)return{grounded:false};
    const feet=body.position.y-CFG.feetOff;
    const s=SF.spanAt(body.position.x,body.position.z,feet+.02,CFG.stepMax);
    if(!s)return{grounded:false};
    return{grounded:Math.abs(feet-s.floor)<.12,ny:1,surf:WORLD.def.surf,dist:feet-s.floor};
  }

  /** Radial damage with distance falloff. */
  explode(pos,radius,dmgBase,src,knock,color,opt={}){
    for(const c of engine.combatants){
      if(!c.alive||!c.body)continue;
      _vd.set(c.body.position.x,c.body.position.y+.3,c.body.position.z).sub(pos);
      const d=_vd.length();
      if(d>radius)continue;
      // Blast is blocked by geometry -- no damage through a solid wall.
      _ve.set(c.body.position.x,c.body.position.y+.3,c.body.position.z);
      if(WORLD.spans&&!WORLD.spans.losClear(pos,_ve))continue;
      const t=1-d/radius;
      let dmg=dmgBase*t*t;                       // quadratic falloff, CS-like
      if(src===c)dmg*=opt.selfMult!==undefined?opt.selfMult:.6;
      if(dmg>=1)c.takeDamage(Math.round(dmg),src,{point:_ve.clone(),head:false,blast:true});
      if(knock){
        _vd.normalize();_vd.y+=.38;_vd.normalize();
        const dv=knock*t*(c===src?.8:1);
        c.body.velocity.x+=_vd.x*dv;
        c.body.velocity.y+=_vd.y*dv*.8;
        c.body.velocity.z+=_vd.z*dv;
      }
    }
    if(engine.player&&engine.player.alive){
      const d=engine.player.body.position.distanceTo(pos);
      GFX.addTrauma(U.clamp(1-d/(radius*2.6),0,1)*.55);
    }
    AUDIO.play("explosion",{pos,vol:.9});
    FX.explosion(pos,radius,color||0xd08840);
  }

  _rayTargets(ignoreComb){
    const list=this.colliders.slice();
    for(const c of engine.combatants){
      if(!c.alive||!c.hitTorso||c===ignoreComb)continue;
      list.push(c.hitTorso,c.hitHead);
    }
    return list;
  }

  combatRay(origin,dir,range,ignoreComb,pierce){
    this.raycaster.set(origin,dir);
    this.raycaster.far=range;
    const hits=this.raycaster.intersectObjects(this._rayTargets(ignoreComb),false);
    const out={chars:[],wall:null};
    for(const h of hits){
      const nrm=h.face?h.face.normal.clone().transformDirection(h.object.matrixWorld):new THREE.Vector3(0,1,0);
      if(h.object.userData.solid){
        out.wall={point:h.point.clone(),dist:h.distance,normal:nrm};
        break;
      }
      if(h.object.userData.comb){
        out.chars.push({ud:h.object.userData.comb,part:h.object.userData.part,point:h.point.clone(),dist:h.distance,normal:nrm});
        if(!pierce)break;
      }
    }
    return out;
  }

  /** Nearest near-vertical surface ahead. Returns its normal, or null. */
  rayWall(origin,dir,len){
    this.raycaster.set(origin,dir);
    this.raycaster.far=len;
    const hits=this.raycaster.intersectObjects(this.colliders,false);
    for(const h of hits){
      const n=h.face?h.face.normal.clone().transformDirection(h.object.matrixWorld):null;
      if(n&&Math.abs(n.y)>.55)continue;      // floor or ceiling, not a wall
      return n||new THREE.Vector3(0,1,0);
    }
    return null;
  }

  groundAt(x,z,y){
    const SF=WORLD&&WORLD.spans;
    if(!SF)return -999;
    return SF.floorAt(x,z,y===undefined?1e6:y,CFG.stepMax);
  }

  segChar(from,to,r,exclude){
    let best=null,bd=1e9;
    for(const c of engine.combatants){
      if(!c.alive||c===exclude||!c.body)continue;
      const p=c.body.position;
      _vd.set(p.x,p.y+.2,p.z);
      _va.subVectors(to,from);
      const len2=_va.lengthSq();
      const t=len2>0?U.clamp(_vb.subVectors(_vd,from).dot(_va)/len2,0,1):0;
      _vc.copy(from).addScaledVector(_va,t);
      const d=_vc.distanceTo(_vd);
      if(d<r+.5&&d<bd){bd=d;best=c}
    }
    return best;
  }

  /**
   * True when nothing blocks sight from a to b.
   * Smokes are checked first because they are the cheapest rejection, then the
   * span field, then thin geometry via a mesh ray.
   */
  losClear(a,b,ignoreComb){
    if(WORLD&&WORLD.smokes&&WORLD.smokes.length){
      for(const s of WORLD.smokes){
        _vd.subVectors(b,a);
        const L2=_vd.lengthSq();
        const t=L2>0?U.clamp(_ve.subVectors(s.p,a).dot(_vd)/L2,0,1):0;
        _vc.copy(a).addScaledVector(_vd,t);
        if(_vc.distanceTo(s.p)<s.r-.4)return false;
      }
    }
    if(WORLD&&WORLD.spans&&!WORLD.spans.losClear(a,b))return false;
    _vf.subVectors(b,a);
    const d=_vf.length();
    if(d<=.4)return true;
    _vf.normalize();
    const r=this.combatRay(a,_vf,d-.35,ignoreComb,false);
    return !r.wall;
  }
}
