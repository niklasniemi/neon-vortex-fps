// Procedural texture factory -- a Dust II-flavoured sandstone palette.
// Everything is drawn to a canvas at load time so the game stays dependency
// free; there are no image downloads beyond the map GLB itself.
import {U} from '../core/util.js';

const px=(g,s,n,fn)=>{for(let i=0;i<n;i++)fn(U.rand(0,s),U.rand(0,s))};

export const TexFac={
cache:{},

get(key,builder){
  if(this.cache[key])return this.cache[key];
  const fn=builder||this.presets[key];
  if(!fn)throw new Error("no texture builder for "+key);
  const t=fn();this.cache[key]=t;return t;
},

make(size,fn){
  const c=document.createElement("canvas");c.width=c.height=size;
  const g=c.getContext("2d");fn(g,size);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;
  return t;
},

presets:{
  sand(){return TexFac.sand()},
  plaster(){return TexFac.plaster()},
  sandbrick(){return TexFac.sandbrick()},
  cobble(){return TexFac.cobble()},
  wood(){return TexFac.wood()},
  plank(){return TexFac.plank()},
  sandbag(){return TexFac.sandbag()},
  barrel(){return TexFac.barrelTex()},
  tarp(){return TexFac.tarp()},
  metal(){return TexFac.metal()},
  rust(){return TexFac.rust()},
  concrete(){return TexFac.concrete()}
},

// --- ground -------------------------------------------------------------
sand(){return this.get("sand",()=>this.make(256,(g,s)=>{
  g.fillStyle="#c1a97e";g.fillRect(0,0,s,s);
  px(g,s,1400,(x,y)=>{g.fillStyle=`rgba(${U.randi(150,205)},${U.randi(130,178)},${U.randi(92,138)},${U.rand(.06,.2)})`;g.fillRect(x,y,U.rand(1,3),U.rand(1,3))});
  // wind-drift striations
  g.strokeStyle="rgba(150,126,88,.28)";g.lineWidth=1.4;
  for(let i=0;i<18;i++){g.beginPath();let x=U.rand(0,s),y=U.rand(0,s);g.moveTo(x,y);
    for(let j=0;j<7;j++){x+=U.rand(-30,30);y+=U.rand(5,24);g.lineTo(x,y)}g.stroke()}
  // scattered gravel
  px(g,s,90,(x,y)=>{g.fillStyle=`rgba(${U.randi(105,140)},${U.randi(92,122)},${U.randi(68,92)},.5)`;g.beginPath();g.arc(x,y,U.rand(1,3.2),0,7);g.fill()});
}))},

cobble(){return this.get("cobble",()=>this.make(256,(g,s)=>{
  g.fillStyle="#8d7f68";g.fillRect(0,0,s,s);
  const n=8,st=s/n;
  for(let r=0;r<n;r++)for(let c2=0;c2<n;c2++){
    const ox=(r%2)*st*.5;
    const x=c2*st+ox,y=r*st;
    g.fillStyle=`rgb(${U.randi(150,186)},${U.randi(134,168)},${U.randi(104,136)})`;
    g.beginPath();
    if(g.roundRect)g.roundRect(x+1.5,y+1.5,st-3,st-3,4); else g.rect(x+1.5,y+1.5,st-3,st-3);
    g.fill();
    g.strokeStyle="rgba(78,68,52,.55)";g.lineWidth=1.5;g.stroke();
  }
  px(g,s,300,(x,y)=>{g.fillStyle=`rgba(60,52,40,${U.rand(.03,.1)})`;g.fillRect(x,y,U.rand(2,5),U.rand(2,5))});
}))},

// --- walls --------------------------------------------------------------
plaster(){return this.get("plaster",()=>this.make(256,(g,s)=>{
  g.fillStyle="#cdb68e";g.fillRect(0,0,s,s);
  px(g,s,600,(x,y)=>{g.fillStyle=`rgba(${U.randi(158,222)},${U.randi(138,196)},${U.randi(100,156)},${U.rand(.05,.16)})`;g.fillRect(x,y,U.rand(2,10),U.rand(2,10))});
  // chipped patches showing the brick beneath
  for(let i=0;i<7;i++){
    const x=U.rand(0,s),y=U.rand(0,s),r=U.rand(10,30);
    g.fillStyle=`rgba(${U.randi(140,170)},${U.randi(100,124)},${U.randi(72,94)},.5)`;
    g.beginPath();g.arc(x,y,r,0,7);g.fill();
  }
  // hairline cracks
  g.strokeStyle="rgba(96,80,58,.35)";g.lineWidth=1;
  for(let i=0;i<9;i++){g.beginPath();let x=U.rand(0,s),y=U.rand(0,s);g.moveTo(x,y);
    for(let j=0;j<4;j++){x+=U.rand(-24,24);y+=U.rand(-24,24);g.lineTo(x,y)}g.stroke()}
  // grime along the bottom edge
  const gr=g.createLinearGradient(0,s*.72,0,s);
  gr.addColorStop(0,"rgba(92,76,54,0)");gr.addColorStop(1,"rgba(92,76,54,.34)");
  g.fillStyle=gr;g.fillRect(0,s*.72,s,s*.28);
}))},

sandbrick(){return this.get("sandbrick",()=>this.make(256,(g,s)=>{
  g.fillStyle="#a8895f";g.fillRect(0,0,s,s);
  const rows=8,bh=s/rows;
  for(let r=0;r<rows;r++){
    const off=(r%2)*(s/6);
    for(let c2=-1;c2<7;c2++){
      const x=c2*(s/6)+off+2,y=r*bh+2,w=s/6-4,h=bh-4;
      g.fillStyle=`rgb(${U.randi(178,208)},${U.randi(150,178)},${U.randi(110,140)})`;
      g.fillRect(x,y,w,h);
      g.strokeStyle="rgba(112,92,66,.6)";g.lineWidth=1.4;g.strokeRect(x,y,w,h);
      if(Math.random()<.3){g.fillStyle=`rgba(120,98,70,${U.rand(.06,.18)})`;g.fillRect(x,y,w,h)}
    }
  }
  px(g,s,260,(x,y)=>{g.fillStyle=`rgba(70,58,42,${U.rand(.03,.1)})`;g.fillRect(x,y,U.rand(2,6),U.rand(2,6))});
}))},

concrete(){return this.get("concrete",()=>this.make(256,(g,s)=>{
  g.fillStyle="#9c9384";g.fillRect(0,0,s,s);
  px(g,s,900,(x,y)=>{g.fillStyle=`rgba(${U.randi(120,180)},${U.randi(116,172)},${U.randi(104,156)},${U.rand(.05,.18)})`;g.fillRect(x,y,U.rand(1,4),U.rand(1,4))});
  g.strokeStyle="rgba(70,66,58,.3)";g.lineWidth=2;
  g.strokeRect(2,2,s-4,s-4);
  px(g,s,40,(x,y)=>{g.fillStyle="rgba(60,56,50,.25)";g.beginPath();g.arc(x,y,U.rand(1.5,4),0,7);g.fill()});
}))},

// --- props --------------------------------------------------------------
wood(){return this.get("wood",()=>this.make(256,(g,s)=>{
  g.fillStyle="#7d5f3c";g.fillRect(0,0,s,s);
  for(let p=0;p<4;p++){
    g.fillStyle=p%2?"#6f5334":"#8a6a44";g.fillRect(0,p*64,s,64);
    g.strokeStyle="rgba(54,38,22,.7)";g.lineWidth=2;
    g.beginPath();g.moveTo(0,p*64);g.lineTo(s,p*64);g.stroke();
  }
  for(let i=0;i<70;i++){
    g.strokeStyle=`rgba(62,44,24,${U.rand(.1,.35)})`;g.lineWidth=1;
    const y=U.rand(0,s);g.beginPath();g.moveTo(U.rand(0,s*.4),y);
    g.bezierCurveTo(U.rand(0,s),y+U.rand(-6,6),U.rand(0,s),y+U.rand(-6,6),U.rand(s*.6,s),y);g.stroke();
  }
  g.fillStyle="#3a2c1a";
  for(let i=0;i<10;i++){g.beginPath();g.arc(U.rand(0,s),U.rand(0,s),U.rand(1.5,3),0,7);g.fill()}
}))},

plank(){return this.get("plank",()=>this.make(256,(g,s)=>{
  for(let i=0;i<6;i++){
    g.fillStyle=`rgb(${U.randi(112,142)},${U.randi(84,108)},${U.randi(54,72)})`;
    g.fillRect(i*(s/6),0,s/6,s);
    g.strokeStyle="rgba(48,34,20,.65)";g.lineWidth=2;g.strokeRect(i*(s/6),0,s/6,s);
  }
  px(g,s,180,(x,y)=>{g.fillStyle=`rgba(50,36,22,${U.rand(.04,.14)})`;g.fillRect(x,y,U.rand(2,7),U.rand(1,3))});
}))},

sandbag(){return this.get("sandbag",()=>this.make(256,(g,s)=>{
  g.fillStyle="#9c8b66";g.fillRect(0,0,s,s);
  for(let y=0;y<4;y++)for(let x=0;x<3;x++){
    const ox=(y%2)*42;
    g.fillStyle=`rgb(${U.randi(146,172)},${U.randi(128,152)},${U.randi(92,116)})`;
    g.beginPath();g.ellipse(ox+42+x*84,32+y*64,44,30,0,0,7);g.fill();
    g.strokeStyle="rgba(84,72,48,.55)";g.lineWidth=3;g.stroke();
  }
  px(g,s,240,(x,y)=>{g.fillStyle=`rgba(74,62,42,${U.rand(.05,.18)})`;g.fillRect(x,y,2,2)});
}))},

barrelTex(){return this.get("barrel",()=>this.make(256,(g,s)=>{
  g.fillStyle="#5e5348";g.fillRect(0,0,s,s);
  for(let i=0;i<44;i++){g.fillStyle=`rgba(${U.randi(118,158)},${U.randi(86,110)},${U.randi(56,78)},${U.rand(.08,.26)})`;g.fillRect(U.rand(0,s),0,U.rand(2,5),s)}
  g.fillStyle="#453c33";
  for(const y of[52,120,190]){g.fillRect(0,y,s,14);g.strokeStyle="rgba(24,20,16,.6)";g.lineWidth=2;g.strokeRect(0,y,s,14)}
  px(g,s,34,(x,y)=>{g.fillStyle=`rgba(146,88,40,${U.rand(.15,.5)})`;g.beginPath();g.arc(x,y,U.rand(2,8),0,7);g.fill()});
}))},

tarp(){return this.get("tarp",()=>this.make(256,(g,s)=>{
  for(let i=0;i<8;i++){g.fillStyle=i%2?"#8a4a3a":"#b0a894";g.fillRect(i*32,0,32,s)}
  px(g,s,320,(x,y)=>{g.fillStyle=`rgba(0,0,0,${U.rand(.03,.1)})`;g.fillRect(x,y,U.rand(2,6),U.rand(2,6))});
}))},

metal(){return this.get("metal",()=>this.make(256,(g,s)=>{
  g.fillStyle="#6e6a62";g.fillRect(0,0,s,s);
  // corrugation
  for(let i=0;i<s;i+=12){
    const l=g.createLinearGradient(i,0,i+12,0);
    l.addColorStop(0,"rgba(255,255,255,.10)");l.addColorStop(.5,"rgba(0,0,0,.14)");l.addColorStop(1,"rgba(255,255,255,.06)");
    g.fillStyle=l;g.fillRect(i,0,12,s);
  }
  px(g,s,50,(x,y)=>{g.fillStyle=`rgba(132,80,38,${U.rand(.1,.35)})`;g.beginPath();g.arc(x,y,U.rand(2,7),0,7);g.fill()});
}))},

rust(){return this.get("rust",()=>this.make(256,(g,s)=>{
  g.fillStyle="#5a4034";g.fillRect(0,0,s,s);
  px(g,s,260,(x,y)=>{const r=U.rand(2,20);g.fillStyle=`rgba(${U.randi(96,164)},${U.randi(50,84)},${U.randi(24,48)},${U.rand(.08,.3)})`;g.beginPath();g.arc(x,y,r,0,7);g.fill()});
  g.strokeStyle="rgba(22,14,10,.5)";g.lineWidth=2;
  for(let i=0;i<12;i++){g.beginPath();g.moveTo(U.rand(0,s),U.rand(0,s));g.lineTo(U.rand(0,s),U.rand(0,s));g.stroke()}
}))},

// --- fx sprites ---------------------------------------------------------
softDot(){return this.get("dot",()=>this.make(64,(g,s)=>{
  const gr=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  gr.addColorStop(0,"rgba(255,255,255,1)");gr.addColorStop(.35,"rgba(255,255,255,.55)");gr.addColorStop(1,"rgba(255,255,255,0)");
  g.fillStyle=gr;g.fillRect(0,0,s,s);
}))},

flashStar(){return this.get("star",()=>this.make(128,(g,s)=>{
  g.translate(s/2,s/2);
  const gr=g.createRadialGradient(0,0,0,0,0,s/2);
  gr.addColorStop(0,"rgba(255,255,255,1)");gr.addColorStop(.25,"rgba(255,255,255,.6)");gr.addColorStop(1,"rgba(255,255,255,0)");
  g.fillStyle=gr;g.fillRect(-s/2,-s/2,s,s);
  g.strokeStyle="rgba(255,255,255,.9)";
  for(let i=0;i<6;i++){g.rotate(Math.PI/3);g.lineWidth=3;g.beginPath();g.moveTo(0,0);g.lineTo(s*.46,0);g.stroke()}
}))}
};

export function matStd(o){
  const key="m"+JSON.stringify(o);
  if(matStd.c[key])return matStd.c[key];
  const p={
    color:o.color!==undefined?o.color:0xffffff,
    roughness:o.rough!==undefined?o.rough:.8,
    metalness:o.metal!==undefined?o.metal:.15
  };
  if(o.map)p.map=o.map;
  if(o.em){p.emissive=new THREE.Color(o.em);p.emissiveIntensity=o.ei!==undefined?o.ei:1}
  if(o.opac!==undefined){p.transparent=true;p.opacity=o.opac;p.depthWrite=o.dw!==undefined?o.dw:false}
  if(o.side)p.side=o.side;
  const m=new THREE.MeshStandardMaterial(p);
  matStd.c[key]=m;return m;
}
matStd.c={};
