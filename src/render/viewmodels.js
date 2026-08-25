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
