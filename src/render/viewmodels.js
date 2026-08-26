// Procedural first-person weapon models.
// Every gun is built from the same small kit (receiver / barrel / grip / stock /
// optic) so silhouettes stay readable and the muzzle anchor is always
// `group.userData.muzzle` -- the weapon system reads that for tracer origins.
import {matStd} from './textures.js';

export const VMMAT={
  park:()=>matStd({color:0x23262a,metal:.72,rough:.46}),   // parkerised steel
  steel:()=>matStd({color:0x3a3f45,metal:.85,rough:.3}),
  poly:()=>matStd({color:0x1a1d21,metal:.05,rough:.78}),   // polymer furniture
  wood:()=>matStd({color:0x6b4a2b,metal:.02,rough:.72}),
  tan:()=>matStd({color:0x8d7a5c,metal:.08,rough:.7}),
  glass:()=>new THREE.MeshStandardMaterial({color:0x0a1418,metal:.9,roughness:.08,emissive:0x0a2028,emissiveIntensity:.4})
};

const BOX=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const CYL=(r,h,s=12)=>new THREE.CylinderGeometry(r,r,h,s);
const CONE=(r1,r2,h,s=12)=>new THREE.CylinderGeometry(r1,r2,h,s,1,true);

function part(parent,geo,m,x,y,z,rx=0,ry=0,rz=0){
  const mesh=new THREE.Mesh(geo,m);
  mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);
  parent.add(mesh);return mesh;
}
// Barrels/tubes run down -Z, so they are built on Y then rotated a quarter turn.
function tube(parent,r,len,m,x,y,z,seg=12){
  const mesh=new THREE.Mesh(CYL(r,len,seg),m);
  mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);
  parent.add(mesh);return mesh;
}
function muzzle(g,x,y,z){const o=new THREE.Object3D();o.position.set(x,y,z);g.add(o);g.userData.muzzle=o;return o}

// Iron sights: a front post and a rear notch on the same axis as the muzzle so
// ADS actually lines up with the crosshair.
function ironSights(g,m,frontZ,rearZ,y){
  part(g,BOX(.008,.032,.008),m,0,y+.026,frontZ);
  part(g,BOX(.030,.008,.010),m,0,y+.022,rearZ);
  part(g,BOX(.008,.020,.010),m,-.013,y+.030,rearZ);
  part(g,BOX(.008,.020,.010),m, .013,y+.030,rearZ);
}

function magazine(g,m,x,y,z,w,h,d,tilt){
  return part(g,BOX(w,h,d),m,x,y,z,tilt||0);
}

export function buildAK47(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),wd=VMMAT.wood(),st=VMMAT.steel();
  part(g,BOX(.058,.085,.34),pk,0,0,-.06);            // receiver
  part(g,BOX(.050,.055,.20),wd,0,-.005,-.30);         // lower handguard
  part(g,BOX(.044,.030,.19),wd,0,.048,-.30);          // upper handguard
  tube(g,.011,.40,st,0,.022,-.46);                    // barrel
  part(g,BOX(.026,.034,.055),pk,0,.022,-.66);         // slant muzzle brake
  part(g,BOX(.030,.026,.10),st,0,.052,-.16);          // gas tube / dust cover
  magazine(g,pk,0,-.105,-.13,.036,.155,.075,-.30);    // banana mag
  part(g,BOX(.040,.075,.055),VMMAT.poly(),0,-.075,.02,.30); // pistol grip
  part(g,BOX(.046,.062,.20),wd,0,.004,.20);           // fixed stock
  ironSights(g,pk,-.60,-.02,.052);
  muzzle(g,0,.022,-.70);
  return g;
}

export function buildM4A1(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),st=VMMAT.steel(),po=VMMAT.poly();
  part(g,BOX(.054,.080,.30),pk,0,0,-.04);
  part(g,BOX(.052,.052,.24),po,0,.010,-.30);          // quad rail
  for(let i=0;i<4;i++)part(g,BOX(.056,.006,.006),pk,0,.037,-.22-i*.05);
  tube(g,.010,.30,st,0,.020,-.50);
  tube(g,.019,.11,pk,0,.020,-.68);                    // suppressor
  part(g,BOX(.034,.030,.10),pk,0,.050,-.10);          // carry-handle rail
  part(g,BOX(.030,.036,.11),pk,0,.052,-.04);          // rear sight block
  magazine(g,po,0,-.100,-.10,.032,.150,.070,-.06);    // STANAG (near vertical)
  part(g,BOX(.038,.072,.052),po,0,-.072,.04,.28);
  part(g,BOX(.044,.058,.14),po,0,.000,.17);           // collapsible stock
  tube(g,.014,.16,pk,0,.000,.15);                     // buffer tube
  ironSights(g,pk,-.56,-.02,.050);
  muzzle(g,0,.020,-.74);
  return g;
}

export function buildAWP(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),st=VMMAT.steel(),po=VMMAT.poly(),gl=VMMAT.glass();
  part(g,BOX(.050,.070,.36),pk,0,0,-.02);             // action
  tube(g,.013,.62,st,0,.016,-.52);                    // long heavy barrel
  part(g,BOX(.028,.028,.09),pk,0,.016,-.85);
  const scope=tube(g,.030,.30,pk,0,.086,-.14,16);     // scope body
  part(g,BOX(.020,.020,.05),pk,0,.055,-.24);          // front ring
  part(g,BOX(.020,.020,.05),pk,0,.055,-.02);          // rear ring
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.028,20),gl);
  lens.position.set(0,.086,-.291);g.add(lens);
  part(g,BOX(.018,.030,.070),st,.038,.010,.06,0,0,.25); // bolt handle
  magazine(g,pk,0,-.070,-.06,.030,.075,.090);
  part(g,BOX(.040,.078,.050),po,0,-.070,.06,.22);
  part(g,BOX(.048,.090,.24),po,0,-.012,.24);          // thumbhole stock
  part(g,BOX(.048,.030,.06),po,0,-.062,.20);          // cheek riser
  g.userData.scope=scope;
  muzzle(g,0,.016,-.90);
  return g;
}

export function buildDeagle(){
  const g=new THREE.Group();
  const st=VMMAT.steel(),pk=VMMAT.park(),po=VMMAT.poly();
  part(g,BOX(.036,.062,.24),st,0,.010,-.06);          // slide
  part(g,BOX(.030,.022,.20),pk,0,.046,-.08);          // rib
  tube(g,.010,.10,pk,0,.010,-.20);
  part(g,BOX(.034,.056,.055),pk,0,-.040,.03);         // frame
  magazine(g,po,0,-.090,.035,.026,.100,.048,.08);
  part(g,BOX(.032,.086,.048),po,0,-.078,.052,.30);    // grip
  part(g,BOX(.012,.026,.014),pk,0,-.020,-.02);        // trigger guard front
  ironSights(g,pk,-.19,.02,.042);
  muzzle(g,0,.010,-.26);
  return g;
}

export function buildGlock(){
  const g=new THREE.Group();
  const po=VMMAT.poly(),pk=VMMAT.park();
  part(g,BOX(.032,.050,.20),pk,0,.010,-.04);          // slide
  for(let i=0;i<5;i++)part(g,BOX(.034,.004,.004),VMMAT.steel(),0,.026,.02-i*.012);
  tube(g,.008,.06,VMMAT.steel(),0,.006,-.15);
  part(g,BOX(.030,.048,.050),po,0,-.036,.02);
  magazine(g,po,0,-.082,.030,.024,.090,.044,.05);
  part(g,BOX(.030,.080,.044),po,0,-.070,.046,.26);
  ironSights(g,pk,-.13,.03,.034);
  muzzle(g,0,.006,-.19);
  return g;
}

export function buildUSP(){
  const g=new THREE.Group();
  const po=VMMAT.poly(),pk=VMMAT.park(),st=VMMAT.steel();
  part(g,BOX(.030,.048,.19),pk,0,.010,-.04);
  tube(g,.017,.13,pk,0,.006,-.20);                    // suppressor
  part(g,BOX(.030,.046,.050),po,0,-.034,.02);
  magazine(g,po,0,-.078,.028,.023,.086,.042,.05);
  part(g,BOX(.030,.076,.044),po,0,-.066,.044,.26);
  ironSights(g,pk,-.12,.03,.032);
  muzzle(g,0,.006,-.27);
  return g;
}

export function buildMP9(){
  const g=new THREE.Group();
  const po=VMMAT.poly(),pk=VMMAT.park(),st=VMMAT.steel();
  part(g,BOX(.046,.070,.22),po,0,0,-.06);             // polymer body
  tube(g,.009,.14,st,0,.014,-.24);
  part(g,BOX(.034,.024,.09),po,0,.044,-.10);          // top rail
  magazine(g,pk,0,-.088,-.05,.028,.130,.058,-.04);
  part(g,BOX(.034,.062,.046),po,0,-.062,.03,.28);
  part(g,BOX(.030,.040,.10),po,0,.006,.12);           // folding stock
  ironSights(g,pk,-.20,-.02,.046);
  muzzle(g,0,.014,-.32);
  return g;
}

export function buildNova(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),wd=VMMAT.wood(),st=VMMAT.steel();
  part(g,BOX(.050,.060,.24),pk,0,0,-.04);             // receiver
  tube(g,.017,.52,st,0,.020,-.42);                    // barrel
  tube(g,.013,.44,pk,0,-.012,-.38);                   // magazine tube
  const pump=part(g,BOX(.052,.048,.13),wd,0,-.012,-.30); // pump forend
  part(g,BOX(.038,.070,.048),wd,0,-.062,.04,.26);
  part(g,BOX(.046,.072,.20),wd,0,-.020,.20);          // stock
  part(g,BOX(.010,.024,.010),pk,0,.044,-.64);         // bead sight
  g.userData.pump=pump;
  muzzle(g,0,.020,-.70);
  return g;
}

// The defuse kit / bomb are held like tools, not guns.
export function buildKnife(){
  const g=new THREE.Group();
  const st=VMMAT.steel(),po=VMMAT.poly();
  part(g,BOX(.016,.004,.20),st,0,0,-.12);
  part(g,BOX(.026,.030,.10),po,0,-.004,.03);
  muzzle(g,0,0,-.22);
  return g;
}

export function buildBombVM(){
  const g=new THREE.Group();
  const po=VMMAT.poly(),pk=VMMAT.park();
  part(g,BOX(.13,.09,.20),po,0,-.02,-.06);
  part(g,BOX(.10,.02,.06),pk,0,.032,-.10);
  const led=new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),
    new THREE.MeshStandardMaterial({color:0x330000,emissive:0xff2200,emissiveIntensity:2}));
  led.position.set(.03,.034,-.13);g.add(led);
  g.userData.led=led;
  muzzle(g,0,0,-.16);
  return g;
}

/**
 * Held grenade. One shape, tinted per type, so you can see what G selected.
 * @param {number} color body colour from NADE_DEFS
 * @param {string} kind he | flash | smoke | molotov
 */
export function buildGrenadeVM(color,kind){
  const g=new THREE.Group();
  const pk=VMMAT.park(), body=matStd({color,metal:.3,rough:.72});

  if(kind==="molotov"){
    // Bottle: tapered glass with a rag in the neck.
    const bot=new THREE.Mesh(new THREE.CylinderGeometry(.045,.052,.13,12),
      new THREE.MeshStandardMaterial({color,metalness:.1,roughness:.25,
        transparent:true,opacity:.85}));
    bot.position.set(0,-.01,-.02);g.add(bot);
    part(g,BOX(.022,.05,.022),pk,0,.07,-.02);
    const rag=new THREE.Mesh(new THREE.CylinderGeometry(.012,.016,.05,8),
      matStd({color:0xd8cba8,rough:.95}));
    rag.position.set(0,.11,-.02);g.add(rag);
  }else if(kind==="smoke"){
    // Canister with a ribbed top.
    const can=new THREE.Mesh(new THREE.CylinderGeometry(.042,.042,.13,12),body);
    can.position.set(0,0,-.02);g.add(can);
    for(let i=0;i<3;i++)part(g,BOX(.088,.006,.088),pk,0,.03-i*.03,-.02);
    part(g,BOX(.03,.02,.03),pk,0,.075,-.02);
  }else{
    // Fragmentation body with a spoon and pin.
    const b=new THREE.Mesh(new THREE.SphereGeometry(.05,14,10),body);
    b.scale.set(1,1.18,1);b.position.set(0,0,-.02);g.add(b);
    part(g,BOX(.028,.028,.028),pk,0,.06,-.02);
    part(g,BOX(.008,.075,.014),pk,.028,.035,-.02,0,0,.12);   // spoon
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.016,.004,6,12),pk);
    ring.position.set(-.03,.062,-.02);ring.rotation.y=Math.PI/2;g.add(ring);
  }
  muzzle(g,0,0,-.08);
  return g;
}

// --- additional weapons ----------------------------------------------------

export function buildMP5(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),st=VMMAT.steel(),po=VMMAT.poly();
  part(g,BOX(.046,.062,.26),pk,0,0,-.06);
  tube(g,.014,.16,pk,0,.016,-.26);                    // shrouded barrel
  for(let i=0;i<4;i++)part(g,BOX(.05,.006,.006),st,0,.042,-.20-i*.04);
  part(g,BOX(.040,.030,.10),po,0,-.030,-.20);         // forend
  magazine(g,pk,0,-.095,-.04,.026,.140,.050,-.02);
  part(g,BOX(.036,.064,.046),po,0,-.060,.04,.28);
  part(g,BOX(.030,.038,.16),pk,0,.006,.16);           // retractable stock
  ironSights(g,pk,-.24,-.02,.044);
  muzzle(g,0,.016,-.34);
  return g;
}

export function buildFamas(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),po=VMMAT.poly(),st=VMMAT.steel();
  part(g,BOX(.050,.078,.40),po,0,0,.02);              // bullpup body
  part(g,BOX(.020,.070,.30),po,0,.058,-.02);          // carry handle
  tube(g,.010,.24,st,0,.016,-.32);
  magazine(g,pk,0,-.090,.10,.030,.130,.060);          // mag behind the grip
  part(g,BOX(.038,.070,.048),po,0,-.062,-.10,.26);
  part(g,BOX(.026,.020,.018),pk,0,.098,-.16);
  muzzle(g,0,.016,-.46);
  return g;
}

export function buildAUG(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),po=VMMAT.poly(),st=VMMAT.steel(),gl=VMMAT.glass();
  part(g,BOX(.052,.080,.38),po,0,0,.02);
  const sc=tube(g,.026,.20,pk,0,.072,-.08,14);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.024,18),gl);
  lens.position.set(0,.072,-.181);g.add(lens);
  tube(g,.010,.26,st,0,.014,-.34);
  part(g,BOX(.044,.048,.10),po,0,-.010,-.22,.18);     // folding foregrip
  magazine(g,pk,0,-.086,.10,.030,.126,.058);
  part(g,BOX(.038,.068,.048),po,0,-.058,-.08,.24);
  g.userData.scope=sc;
  muzzle(g,0,.014,-.48);
  return g;
}

export function buildNegev(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),st=VMMAT.steel(),po=VMMAT.poly();
  part(g,BOX(.066,.090,.34),pk,0,0,-.04);             // heavy receiver
  tube(g,.014,.36,st,0,.024,-.42);
  for(let i=0;i<5;i++)part(g,BOX(.034,.008,.008),pk,0,.044,-.30-i*.05); // heat shield
  const drum=new THREE.Mesh(new THREE.BoxGeometry(.10,.11,.15),po);
  drum.position.set(0,-.10,-.02);g.add(drum);         // belt box
  part(g,BOX(.044,.074,.052),po,0,-.070,.06,.26);
  part(g,BOX(.050,.070,.20),po,0,-.010,.22);
  part(g,BOX(.030,.024,.10),pk,0,.058,-.14);          // bipod stow
  ironSights(g,pk,-.56,-.02,.058);
  muzzle(g,0,.024,-.62);
  return g;
}

export function buildRevolver(){
  const g=new THREE.Group();
  const st=VMMAT.steel(),po=VMMAT.poly(),pk=VMMAT.park();
  part(g,BOX(.030,.040,.16),st,0,.014,-.08);
  const cyl=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.055,12),st);
  cyl.rotation.x=Math.PI/2;cyl.position.set(0,.008,.01);g.add(cyl);
  tube(g,.010,.16,pk,0,.014,-.18);
  part(g,BOX(.026,.016,.14),pk,0,.038,-.16);          // top rib
  part(g,BOX(.030,.070,.050),po,0,-.052,.06,.34);
  ironSights(g,pk,-.24,.02,.040);
  muzzle(g,0,.014,-.27);
  return g;
}

// --- sandbox ---------------------------------------------------------------
// Deliberately not realistic. These are the toys.

export function buildGaussRifle(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),st=VMMAT.steel();
  const glow=new THREE.MeshStandardMaterial({color:0x0a2030,emissive:0x35d6ff,emissiveIntensity:2.2});
  part(g,BOX(.056,.070,.34),pk,0,0,-.04);
  // Twin accelerator rails with coils between them.
  for(const sx of[-1,1])part(g,BOX(.014,.030,.52),st,sx*.030,.022,-.42);
  for(let i=0;i<5;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.040,.008,6,14),glow);
    ring.rotation.y=Math.PI/2;ring.position.set(0,.022,-.22-i*.10);g.add(ring);
  }
  const core=part(g,BOX(.012,.012,.50),glow,0,.022,-.42);
  part(g,BOX(.040,.076,.050),VMMAT.poly(),0,-.066,.04,.28);
  part(g,BOX(.046,.060,.18),pk,0,-.004,.18);
  g.userData.core=core;
  muzzle(g,0,.022,-.70);
  return g;
}

export function buildGravityGun(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),st=VMMAT.steel();
  const glow=new THREE.MeshStandardMaterial({color:0x1a0a24,emissive:0xb18cff,emissiveIntensity:2});
  part(g,BOX(.090,.100,.24),pk,0,0,-.04);
  // Three prongs around a floating core.
  for(let i=0;i<3;i++){
    const a=i/3*Math.PI*2;
    const pr=new THREE.Mesh(new THREE.BoxGeometry(.020,.020,.20),st);
    pr.position.set(Math.cos(a)*.055,.01+Math.sin(a)*.055,-.22);
    pr.lookAt(0,.01,-.40);
    g.add(pr);
  }
  const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.036,1),glow);
  orb.position.set(0,.01,-.22);g.add(orb);
  part(g,BOX(.044,.080,.052),VMMAT.poly(),0,-.072,.03,.26);
  g.userData.orb=orb;
  muzzle(g,0,.01,-.34);
  return g;
}

export function buildBouncer(){
  const g=new THREE.Group();
  const pk=VMMAT.park(),po=VMMAT.poly();
  const glow=new THREE.MeshStandardMaterial({color:0x24200a,emissive:0xffe14d,emissiveIntensity:1.8});
  tube(g,.052,.34,pk,0,.010,-.24);                    // wide bore
  const mouth=new THREE.Mesh(new THREE.CylinderGeometry(.082,.052,.10,14,1,true),pk);
  mouth.rotation.x=Math.PI/2;mouth.position.set(0,.010,-.42);g.add(mouth);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.056,.056,.05,14),glow);
  band.rotation.x=Math.PI/2;band.position.set(0,.010,-.28);g.add(band);
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(.070,.070,.09,10),po);
  drum.rotation.z=Math.PI/2;drum.position.set(0,-.05,-.02);g.add(drum);
  part(g,BOX(.040,.072,.048),po,0,-.068,.08,.28);
  g.userData.band=band;
  muzzle(g,0,.010,-.48);
  return g;
}
