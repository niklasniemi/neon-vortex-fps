// Renderer, post-processing chain and the separate view-model pass.
// The view model renders in its own scene with its own near plane so the gun
// can never clip into world geometry.
import {CFG,SETTINGS} from '../core/config.js';
import {U,_va,_vb,_vc} from '../core/util.js';
import {WORLD,UI,engine} from '../core/globals.js';

export const FinalShader={
uniforms:{tDiffuse:{value:null},uCA:{value:.25},uVig:{value:.62},uHurt:{value:0},uGrain:{value:1},uTint:{value:new THREE.Vector3(1,1,1)},uTintAmt:{value:.35},uTime:{value:0}},
vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
fragmentShader:[
"uniform sampler2D tDiffuse;uniform float uCA,uVig,uHurt,uTintAmt,uTime,uGrain;uniform vec3 uTint;varying vec2 vUv;",
"float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
"void main(){",
"vec2 d=vUv-.5;float r2=dot(d,d);",
"vec2 uv=vUv-d*r2*uCA*.28;",
"vec2 off=d*uCA*.012;",
"vec3 col;",
"col.r=texture2D(tDiffuse,uv+off).r;",
"col.g=texture2D(tDiffuse,uv).g;",
"col.b=texture2D(tDiffuse,uv-off).b;",
"col=mix(col,col*uTint*1.16,uTintAmt);",
"float lum=dot(col,vec3(.299,.587,.114));",
"col=mix(col,vec3(lum),-.16);",
"float vig=smoothstep(.92,.32,length(d));",
"col*=mix(.24,1.,vig)*(1.-uVig*.35);",
"col=mix(col,vec3(.66,.03,.07),uHurt*smoothstep(.1,.72,length(d)));",
"col+=(hash(vUv*vec2(1613.,907.)+fract(uTime)*7.3)*.05-.025)*uGrain;",
"gl_FragColor=vec4(col,1.0);}"
].join("\n")
};
export class GraphicsPipeline{
constructor(container){
this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
const pr=Math.min(devicePixelRatio||1,1.75);
this.renderer.setPixelRatio(pr);
this.renderer.setSize(innerWidth,innerHeight);
this.renderer.shadowMap.enabled=true;
this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
this.renderer.outputEncoding=THREE.sRGBEncoding;
this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
this.renderer.toneMappingExposure=1.06;
container.appendChild(this.renderer.domElement);
this.scene=new THREE.Scene();
this.camera=new THREE.PerspectiveCamera(SETTINGS.fov,innerWidth/innerHeight,.07,520);
this.camera.rotation.order="YXZ";
this.scene.add(this.camera);
this.lightRig=null;this.skyGroup=null;
this.vmScene=new THREE.Scene();
this.vmCam=new THREE.PerspectiveCamera(SETTINGS.fov,innerWidth/innerHeight,.01,6);
this.vmScene.add(this.vmCam);
this.vmScene.add(new THREE.HemisphereLight(0xffffff,0x3a4a5a,1.15));
const vmD=new THREE.DirectionalLight(0xfff4e0,.9);vmD.position.set(.6,1,.4);this.vmScene.add(vmD);
this.trauma=0;
this.fovCur=SETTINGS.fov;
this.hasComposer=!!(THREE.EffectComposer&&THREE.RenderPass&&THREE.ShaderPass&&THREE.UnrealBloomPass);
if(this.hasComposer){
this.composer=new THREE.EffectComposer(this.renderer);
this.composer.addPass(new THREE.RenderPass(this.scene,this.camera));
this.vmPass=new THREE.RenderPass(this.vmScene,this.vmCam);
this.vmPass.clear=false;this.vmPass.clearDepth=true;
this.composer.insertPass(this.vmPass,1);
this.bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.9,.55,.74);
this.composer.addPass(this.bloom);
this.final=new THREE.ShaderPass(FinalShader);
this.composer.addPass(this.final);
}else{
this.final={uniforms:{uHurt:{value:0},uTime:{value:0}}};
}
addEventListener("resize",()=>{
this.camera.aspect=innerWidth/innerHeight;
this.camera.updateProjectionMatrix();
this.vmCam.aspect=innerWidth/innerHeight;
this.vmCam.updateProjectionMatrix();
this.renderer.setSize(innerWidth,innerHeight);
if(this.composer)this.composer.setSize(innerWidth,innerHeight);
});
}
clearArena(){
if(this.lightRig){this.scene.remove(this.lightRig);this.lightRig=null}
if(this.skyGroup){this.scene.remove(this.skyGroup);this.skyGroup=null}
this.scene.fog=null;
}
setupArena(cfg,bounds){
this.clearArena();
this.scene.background=new THREE.Color(cfg.bg);
this.scene.fog=new THREE.Fog(cfg.fog.c,cfg.fog.n,cfg.fog.f);
const rig=new THREE.Group();
const hemi=new THREE.HemisphereLight(cfg.hemi.s,cfg.hemi.g,cfg.hemi.i);
rig.add(hemi);
rig.add(new THREE.AmbientLight(0xffffff,cfg.ambLight||0));
const sun=new THREE.DirectionalLight(cfg.sun.c,cfg.sun.i);
sun.position.set(...cfg.sun.p);
sun.castShadow=true;
sun.shadow.mapSize.set(3072,3072);
sun.shadow.radius=2.2;
const ext=Math.max(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ)*.75+6;
const c=sun.shadow.camera;
c.left=-ext;c.right=ext;c.top=ext;c.bottom=-ext;c.near=2;c.far=140;
sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;
sun.target.position.set(0,0,0);
rig.add(sun,sun.target);
this.lightRig=rig;this.scene.add(rig);
// Sky dome: a vertical gradient from hazy horizon to deep zenith. Cheap,
// and it stops the background reading as a flat fill colour.
{
const sky=new THREE.Mesh(
  new THREE.SphereGeometry(400,24,16),
  new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{
      uTop:{value:new THREE.Color(cfg.skyTop||0x6f9fd0)},
      uHorizon:{value:new THREE.Color(cfg.fog.c)},
      uSun:{value:new THREE.Vector3(...cfg.sun.p).normalize()},
      uSunCol:{value:new THREE.Color(cfg.sun.c)}
    },
    vertexShader:`varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      uniform vec3 uTop,uHorizon,uSun,uSunCol;varying vec3 vD;
      void main(){
        float h=clamp(vD.y*1.15+.08,0.,1.);
        vec3 c=mix(uHorizon,uTop,pow(h,.72));
        // broad sun glow near the light direction
        float s=max(dot(normalize(vD),normalize(uSun)),0.);
        c+=uSunCol*pow(s,26.)*.85;
        c+=uSunCol*pow(s,3.)*.10;
        gl_FragColor=vec4(c,1.);
      }`
  })
);
sky.frustumCulled=false;
this.skyGroup=new THREE.Group();this.skyGroup.add(sky);
this.scene.add(this.skyGroup);
}
if(this.hasComposer){
this.bloomBase=cfg.bloom.s;this.bloom.radius=cfg.bloom.r;this.bloom.threshold=cfg.bloom.t;this.bloom.strength=this.bloomBase*SETTINGS.bloomAmt;
this.final.uniforms.uTint.value.set(...cfg.grade.tint);
this.final.uniforms.uTintAmt.value=cfg.grade.amt;
}
}
addTrauma(x){this.trauma=Math.min(1,this.trauma+x*SETTINGS.shake)}
setFovInstant(f){this.fovCur=f;this.camera.fov=f;this.camera.updateProjectionMatrix()}
updatePlayerCamera(p,dt){
if(!p)return;
_va.copy(p.body.position);
_va.y+=U.lerp(CFG.eyeH,CFG.crouchEye,p.crouchAmt)-CFG.feetOff;
const bobK=p.bobAmt*(1-p.adsAmt*.75)*SETTINGS.bob;
_va.x+=Math.cos(p.bobPhase)*.03*bobK;
_va.y+=Math.sin(p.bobPhase*2)*.045*bobK-p.landDip;
_va.z+=Math.sin(p.bobPhase)*.02*bobK;
const tr=this.trauma;
const sh=tr*tr;
const t=performance.now()/1000;
const sk=SETTINGS.shake;const pit=U.noise1(t*17)*.05*sh*sk,yawO=U.noise1(t*21+40)*.055*sh*sk,roll=U.noise1(t*13+80)*.045*sh*sk;
_va.x+=U.noise1(t*29)*.09*sh*sk;
_va.z+=U.noise1(t*31+60)*.09*sh*sk;
this.camera.position.copy(_va);
const lean=-(p.ctrl? p.ctrl.mx:0)*.016+(p.slideT>0?.07*Math.sin(p.slideT/.85*Math.PI):0);
this.camera.rotation.set(p.pitch+p.recoil.p+pit,p.yaw+p.recoil.y+yawO,lean+roll);
let target=SETTINGS.fov;
if(p.alive){
const spd=Math.sqrt(p.body.velocity.x**2+p.body.velocity.z**2);
target=U.lerp(SETTINGS.fov+(spd>1.5?4:0)+(p.slideT>0?5:0),p.currentCfg().adsFov,p.adsAmt);
}
this.fovCur=U.damp(this.fovCur,target,11,dt);
if(Math.abs(this.camera.fov-this.fovCur)>.02){this.camera.fov=this.fovCur;this.camera.updateProjectionMatrix()}
this.trauma=Math.max(0,this.trauma-dt*1.35);
}
render(dt){
this.vmCam.fov=this.camera.fov;this.vmCam.aspect=this.camera.aspect;
this.vmCam.updateProjectionMatrix();
this.final.uniforms.uTime.value+=dt;
this.final.uniforms.uHurt.value=UI?UI.hurtLevel:0;
this.final.uniforms.uGrain.value=SETTINGS.grain?1:0;
this.final.uniforms.uCA.value=SETTINGS.ca?.25:0;
if(this.hasComposer)this.bloom.strength=(this.bloomBase||.8)*SETTINGS.bloomAmt;
if(this.hasComposer)this.composer.render(dt);
else this.renderer.render(this.scene,this.camera);
}
}
const $=id=>document.getElementById(id);