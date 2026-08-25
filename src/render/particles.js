import {U,_va,_vb,_vc,_vd,_ve,_vf} from '../core/util.js';
import {SETTINGS} from '../core/config.js';
import {GFX,WORLD,engine} from '../core/globals.js';
import {TexFac,matStd} from './textures.js';

export const PART_DEFS={
spark:{n:16,spd:[4,12],life:[.2,.5],s0:[.09,.16],s1:[0,.02],grav:-10,drag:1.6,cols:[[1,.85,.45],[1,.55,.18],[1,1,.85]]},
smoke:{n:9,spd:[.6,2.4],life:[.7,1.5],s0:[.4,.7],s1:[1.2,2],grav:.5,drag:1.2,cols:[[.25,.25,.28],[.35,.33,.3]],smoke:true,a:.32},
ember:{n:5,spd:[1,4],life:[.5,1.2],s0:[.07,.13],s1:[0,.01],grav:3,drag:.4,cols:[[1,.5,.1],[1,.8,.2]]},
shell:{n:1,spd:[2.2,3.6],life:[.5,.8],s0:[.06,.08],s1:[.04,.05],grav:-14,drag:.2,cols:[[.95,.75,.3]],dirBias:1},
trailP:{n:2,spd:[.2,.8],life:[.25,.45],s0:[.14,.22],s1:[.02,.05],grav:0,drag:2,cols:[[.5,1,.3]]},
trailV:{n:2,spd:[.2,.8],life:[.25,.45],s0:[.14,.22],s1:[.02,.05],grav:0,drag:2,cols:[[1,.9,.3]]},
heal:{n:10,spd:[.5,1.6],life:[.5,.9],s0:[.1,.16],s1:[.01,.03],grav:2.5,drag:.5,cols:[[.36,1,.56]]},
confetti:{n:40,spd:[3,9],life:[.7,1.4],s0:[.09,.15],s1:[.03,.06],grav:-7,drag:.8,cols:[[.21,.84,1],[1,.63,.24],[.62,1,.35],[1,.35,.84]]},
zapbit:{n:12,spd:[3,8],life:[.12,.3],s0:[.08,.13],s1:[0,.01],grav:-4,drag:1,cols:[[.5,.8,1],[.85,.95,1]]},
puff:{n:6,spd:[.8,2.4],life:[.25,.45],s0:[.12,.2],s1:[.3,.5],grav:0,drag:2.4,cols:[[.75,.85,1]],smoke:true,a:.25},
};
export class GpuPoints{
constructor(scene,cap,additive){
this.cap=cap;this.count=0;
this.pos=new Float32Array(cap*3);this.vel=new Float32Array(cap*3);
this.life=new Float32Array(cap);this.maxLife=new Float32Array(cap);
this.s0=new Float32Array(cap);this.s1=new Float32Array(cap);
this.col=new Float32Array(cap*3);this.alp=new Float32Array(cap);
this.grav=new Float32Array(cap);this.drag=new Float32Array(cap);
const geo=new THREE.BufferGeometry();
geo.setAttribute("position",new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));
this.aCol=new Float32Array(cap*4);this.aSize=new Float32Array(cap);
geo.setAttribute("aCol",new THREE.BufferAttribute(this.aCol,4).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute("aSize",new THREE.BufferAttribute(this.aSize,1).setUsage(THREE.DynamicDrawUsage));
const material=new THREE.ShaderMaterial({
uniforms:{uMap:{value:TexFac.softDot()}},
vertexShader:"attribute float aSize;attribute vec4 aCol;varying vec4 vCol;void main(){vCol=aCol;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*(340.0/max(0.1,-mv.z));gl_Position=projectionMatrix*mv;}",
fragmentShader:"uniform sampler2D uMap;varying vec4 vCol;void main(){vec4 t=texture2D(uMap,gl_PointCoord);gl_FragColor=vec4(vCol.rgb,vCol.a)*t;if(gl_FragColor.a<0.01)discard;}",
transparent:true,depthWrite:false,
blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
this.mesh=new THREE.Points(geo,material);
this.mesh.frustumCulled=false;
scene.add(this.mesh);
}
spawn(o){
let i;
if(this.count<this.cap)i=this.count++;
else i=Math.floor(Math.random()*this.cap);
this.pos[i*3]=o.x;this.pos[i*3+1]=o.y;this.pos[i*3+2]=o.z;
this.vel[i*3]=o.vx;this.vel[i*3+1]=o.vy;this.vel[i*3+2]=o.vz;
this.life[i]=o.life;this.maxLife[i]=o.life;
this.s0[i]=o.s0;this.s1[i]=o.s1;
this.col[i*3]=o.r;this.col[i*3+1]=o.g;this.col[i*3+2]=o.b;
this.alp[i]=o.a!==undefined?o.a:1;
this.grav[i]=o.grav||0;this.drag[i]=o.drag||0;
}
kill(i){
const l=--this.count;
if(i!==l){
for(let k=0;k<3;k++){this.pos[i*3+k]=this.pos[l*3+k];this.vel[i*3+k]=this.vel[l*3+k];this.col[i*3+k]=this.col[l*3+k]}
this.life[i]=this.life[l];this.maxLife[i]=this.maxLife[l];
this.s0[i]=this.s0[l];this.s1[i]=this.s1[l];this.alp[i]=this.alp[l];
this.grav[i]=this.grav[l];this.drag[i]=this.drag[l];
}
}
update(dt){
for(let i=this.count-1;i>=0;i--){
this.life[i]-=dt;
if(this.life[i]<=0){this.kill(i);continue}
const dmp=1/(1+this.drag[i]*dt);
this.vel[i*3]*=dmp;this.vel[i*3+1]=this.vel[i*3+1]*dmp+this.grav[i]*dt;this.vel[i*3+2]*=dmp;
this.pos[i*3]+=this.vel[i*3]*dt;this.pos[i*3+1]+=this.vel[i*3+1]*dt;this.pos[i*3+2]+=this.vel[i*3+2]*dt;
}
for(let i=0;i<this.count;i++){
const t=this.life[i]/this.maxLife[i];
this.aSize[i]=U.lerp(this.s1[i],this.s0[i],t);
this.aCol[i*4]=this.col[i*3];this.aCol[i*4+1]=this.col[i*3+1];this.aCol[i*4+2]=this.col[i*3+2];
this.aCol[i*4+3]=this.alp[i]*(t<.7?t/.7:1)*Math.min(1,t*3+.15);
}
const g=this.mesh.geometry;
g.attributes.position.needsUpdate=true;g.attributes.aCol.needsUpdate=true;g.attributes.aSize.needsUpdate=true;
g.setDrawRange(0,this.count);
}
}
export class ParticleFX{
constructor(scene){
this.scene=scene;
this.addSys=new GpuPoints(scene,3600,true);
this.smkSys=new GpuPoints(scene,900,false);
this.scroll=[];
this.tracers=[];this.beams=[];this.rings=[];this.flashes=[];this.zaps=[];this.texts=[];
this.textCache={};this.textCount=0;
this.lights=[];
for(let i=0;i<8;i++){const L=new THREE.PointLight(0xffffff,0,18,2);scene.add(L);this.lights.push(L)}
}
preset(name,pos,o={}){
const def=PART_DEFS[name];if(!def)return;
const sys=def.smoke?this.smkSys:this.addSys;
const n=Math.ceil((o.count||def.n)*(o.mult||1));
for(let i=0;i<n;i++){
const sp=U.rand(def.spd[0],def.spd[1])*(o.speedMult||1);
_va.set(U.rand(-1,1),U.rand(-1,1),U.rand(-1,1)).normalize();
if(o.normal){_va.add(o.normal).normalize()}
if(o.dir){_va.copy(o.dir).multiplyScalar(1.2).add(_vb.set(U.rand(-.5,.5),U.rand(-.5,.5),U.rand(-.5,.5))).normalize()}
const col=o.color?o.color:U.pick(def.cols);
sys.spawn({x:pos.x+U.rand(-.06,.06),y:pos.y+U.rand(-.06,.06),z:pos.z+U.rand(-.06,.06),
vx:_va.x*sp,vy:_va.y*sp,vz:_va.z*sp,
life:U.rand(def.life[0],def.life[1]),s0:U.rand(def.s0[0],def.s1[0]),s1:U.rand(def.s1[0]||0,def.s1[1]||0),
r:col[0],g:col[1],b:col[2],a:o.a!==undefined?o.a:(def.a||1),grav:def.grav,drag:def.drag});
}
}
spark(pos,n,color,count,mult){this.preset("spark",pos,{normal:n,color,count,mult})}
tracer(a,b,color){
let t=this.tracers.find(t=>t.life<=0);
if(!t){
const geo=new THREE.BufferGeometry();
geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(6),3).setUsage(THREE.DynamicDrawUsage));
const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));
line.frustumCulled=false;this.scene.add(line);
t={line,life:0,max:.08};this.tracers.push(t);
}
const p=t.line.geometry.attributes.position.array;
p[0]=a.x;p[1]=a.y;p[2]=a.z;p[3]=b.x;p[4]=b.y;p[5]=b.z;
t.line.geometry.attributes.position.needsUpdate=true;
t.line.material.color.setHex(color);t.line.visible=true;t.life=t.max=.07;
}
beam(a,b,color,life=.9){
let bm=this.beams.find(b=>b.life<=0);
if(!bm){
const grp=new THREE.Group();
const core=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1,6,1,true),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
const glow=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1,6,1,true),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));
grp.add(core,glow);grp.visible=false;this.scene.add(grp);
bm={grp,core,glow,life:0,max:life};this.beams.push(bm);
}
bm.core.material.color.setHex(color);bm.glow.material.color.setHex(color);
_vd.subVectors(b,a);const len=_vd.length();
bm.grp.position.copy(a).addScaledVector(_vd,.5);
bm.grp.quaternion.setFromUnitVectors(_ve.set(0,1,0),_vd.normalize());
bm.grp.scale.set(1,len,1);bm.grp.visible=true;bm.life=bm.max=life;
}
ring(pos,color,maxR,normal){
let r=this.rings.find(r=>r.life<=0);
if(!r){
const m=new THREE.Mesh(new THREE.RingGeometry(.42,.5,48),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
m.visible=false;this.scene.add(m);r={m,life:0,max:.5,maxR:3};this.rings.push(r);
}
r.m.material.color.setHex(color);
r.m.position.copy(pos);
_va.set(0,1,0);
if(normal)_va.copy(normal);
r.m.quaternion.setFromUnitVectors(_vb.set(0,0,1),_va);
r.maxR=maxR;r.life=r.max=.45;r.m.visible=true;r.m.scale.setScalar(.2);
}
shockSphere(pos,color,maxR){
let s=this.flashes.find(f=>f.kind==="sh"&&f.life<=0)||null;
if(!s){
const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
m.visible=false;m.kind="sh";this.scene.add(m);
s={kind:"sh",m,life:0,max:.35,maxR:4};this.flashes.push(s);
}
s.m.material.color.setHex(color);s.m.position.copy(pos);
s.maxR=maxR;s.life=s.max=.35;s.m.visible=true;s.m.scale.setScalar(.3);
}
flash(pos,color,size){
let f=this.flashes.find(f=>f.kind==="fl"&&f.life<=0);
if(!f){
const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:TexFac.flashStar(),color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
spr.visible=false;spr.kind="fl";this.scene.add(spr);
f={kind:"fl",m:spr,life:0,max:.12,size:2};this.flashes.push(f);
}
f.m.material.color.setHex(color);f.m.position.copy(pos);
f.size=size;f.life=f.max=.11;f.m.visible=true;f.m.scale.setScalar(size*.5);
}
lightClaim(pos,color,intensity,dist){
let best=null,bestI=1e9;
for(const L of this.lights){if(L.intensity<bestI){bestI=L.intensity;best=L}}
best.position.copy(pos);best.color.setHex(color);best.intensity=intensity;best.distance=dist||20;
}
zap(a,b,color){
let z=this.zaps.find(z=>z.life<=0);
if(!z){
const geo=new THREE.BufferGeometry();
geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(24),3).setUsage(THREE.DynamicDrawUsage));
const seg=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
seg.frustumCulled=false;seg.visible=false;this.scene.add(seg);
z={seg,life:0,max:.14};this.zaps.push(z);
}
z.seg.material.color.setHex(color);z.a=a;z.b=b;z.life=z.max=.13;z.seg.visible=true;
this._jag(z);
}
_jag(z){
const p=z.seg.geometry.attributes.position.array;
_vc.subVectors(z.b,z.a);
for(let i=0;i<8;i+=2){
const t=i/6;
p[i*3]=z.a.x+_vc.x*t+U.rand(-.5,.5);p[i*3+1]=z.a.y+_vc.y*t+U.rand(-.5,.5);p[i*3+2]=z.a.z+_vc.z*t+U.rand(-.5,.5);
if(i+1<8){const t2=(i+1)/6;p[(i+1)*3]=z.a.x+_vc.x*t2+U.rand(-.5,.5);p[(i+1)*3+1]=z.a.y+_vc.y*t2+U.rand(-.5,.5);p[(i+1)*3+2]=z.a.z+_vc.z*t2+U.rand(-.5,.5)}
else{p[(i+1)*3]=z.b.x;p[(i+1)*3+1]=z.b.y;p[(i+1)*3+2]=z.b.z}
}
z.seg.geometry.attributes.position.needsUpdate=true;
}
floatText(pos,txt,colorCss){
let key=txt+"|"+colorCss;
let tex=this.textCache[key];
if(!tex){
if(this.textCount>90){this.textCache={};this.textCount=0}
const c=document.createElement("canvas");c.width=256;c.height=64;
const g=c.getContext("2d");
g.font="900 38px Segoe UI,Arial";g.textAlign="center";g.textBaseline="middle";
g.strokeStyle="rgba(0,0,0,.9)";g.lineWidth=7;g.strokeText(txt,128,34);
g.fillStyle=colorCss;g.fillText(txt,128,34);
tex=new THREE.CanvasTexture(c);this.textCache[key]=tex;this.textCount++;
}
let s=this.texts.find(s=>s.life<=0);
if(!s){
const spr=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false}));
spr.scale.set(1.9,.48,1);this.scene.add(spr);
s={spr,life:0,max:.8};this.texts.push(s);
}
s.spr.material.map=tex;s.spr.material.needsUpdate=true;
s.spr.position.copy(pos).add(_vf.set(U.rand(-.2,.2),U.rand(0,.2),U.rand(-.2,.2)));
s.life=s.max=.85;s.spr.visible=true;
}
explosion(pos,radius,color){
this.flash(pos,color,radius*1.6);
this.shockSphere(pos,color,radius*.9);
this.preset("spark",pos,{count:30,mult:radius/3,speedMult:radius/3.4});
this.preset("smoke",pos,{count:10,speedMult:radius/4});
this.lightClaim(pos,color,6,radius*5);
}
smokePlumes=[];firesV=[];
smokeBloom(p){
const grp=new THREE.Group();
for(let i=0;i<30;i++){
const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:TexFac.softDot(),color:0x9aa4ab,transparent:true,opacity:0,depthWrite:false}));
const a=U.rand(0,6.28),r=U.rand(.3,2.4);
spr.position.set(Math.cos(a)*r,U.rand(.2,2.2),Math.sin(a)*r);
spr.scale.setScalar(U.rand(2.2,4.2));
spr.userData={ph:U.rand(0,6),bs:U.rand(.4,1)};
grp.add(spr);
}
grp.position.copy(p);
this.scene.add(grp);
this.smokePlumes.push({grp,life:15,max:15});
}
fireStart(p){
const grp=new THREE.Group();
const flames=[];
for(let i=0;i<16;i++){
const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:TexFac.softDot(),color:i%3?0xff7a26:0xffc84d,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false}));
const a=U.rand(0,6.28),r=U.rand(.2,2.6);
spr.position.set(Math.cos(a)*r,.25,Math.sin(a)*r);
spr.scale.setScalar(U.rand(.7,1.6));
grp.add(spr);flames.push(spr);
}
const L=new THREE.PointLight(0xff8a30,2.4,9,2);L.position.y=.6;grp.add(L);
grp.position.copy(p);
this.scene.add(grp);
this.firesV.push({grp,flames,L,life:7,max:7});
}
flashPop(p){
const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:TexFac.flashStar(),color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
spr.position.copy(p);spr.scale.setScalar(.5);
this.scene.add(spr);
this.flashes.push({kind:"fl",m:spr,life:.3,max:.3,size:9});
}
update(dt){
for(let i=this.smokePlumes.length-1;i>=0;i--){
const s=this.smokePlumes[i];s.life-=dt;
const t=s.life/s.max;
const fadeIn=U.clamp((s.max-s.life)/.9,0,1);
const fadeOut=U.clamp(s.life/1.6,0,1);
for(const spr of s.grp.children){
spr.material.opacity=.62*Math.min(fadeIn,fadeOut);
spr.material.rotation+=dt*.05*spr.userData.bs;
spr.position.y+=dt*.06*spr.userData.bs;
}
s.grp.scale.setScalar(1+(1-t)*.25);
if(s.life<=0){this.scene.remove(s.grp);this.smokePlumes.splice(i,1)}
}
for(let i=this.firesV.length-1;i>=0;i--){
const f=this.firesV[i];f.life-=dt;
const fade=U.clamp(f.life/1,0,1);
for(const fl of f.flames){
fl.position.y=.22+Math.abs(Math.sin(engine.time*7+fl.position.x*3))*.5;
fl.scale.setScalar(U.rand(.6,1.5)*fade);
fl.material.opacity=.8*fade;
}
f.L.intensity=(2+Math.sin(engine.time*23)*.7)*fade;
if(f.life<=0){this.scene.remove(f.grp);this.firesV.splice(i,1)}
}
for(const m of this.scroll){
const s=m.userData&&m.userData.scroll;
if(s&&m.map){m.map.offset.x+=s[0]*dt;m.map.offset.y+=s[1]*dt}
}
this.addSys.update(dt);this.smkSys.update(dt);
for(const t of this.tracers){if(t.life>0){t.life-=dt;t.line.material.opacity=Math.max(0,t.life/t.max);if(t.life<=0)t.line.visible=false}}
for(const b of this.beams){if(b.life>0){b.life-=dt;const o=Math.max(0,b.life/b.max);b.core.material.opacity=o;b.glow.material.opacity=o*.55;if(b.life<=0)b.grp.visible=false}}
for(const r of this.rings){if(r.life>0){r.life-=dt;const t=1-r.life/r.max;r.m.scale.setScalar(.2+r.maxR*t);r.m.material.opacity=1-t;if(r.life<=0)r.m.visible=false}}
for(const f of this.flashes){
if(f.life<=0)continue;
f.life-=dt;const t=1-f.life/f.max;
if(f.kind==="sh"){f.m.scale.setScalar(.3+f.maxR*t);f.m.material.opacity=(1-t)*.8;if(f.life<=0)f.m.visible=false}
else{f.m.scale.setScalar(f.size*(0.5+t));f.m.material.opacity=1-t;if(f.life<=0)f.m.visible=false}
}
for(const z of this.zaps){if(z.life>0){z.life-=dt;this._jag(z);z.seg.material.opacity=Math.max(0,z.life/z.max);if(z.life<=0)z.seg.visible=false}}
for(const s of this.texts){if(s.life>0){s.life-=dt;s.spr.position.y+=dt*1.1;s.spr.material.opacity=Math.min(1,s.life/s.max*1.6);if(s.life<=0)s.spr.visible=false}}
for(const L of this.lights)if(L.intensity>.02)L.intensity*=Math.exp(-dt*11);
}
}
