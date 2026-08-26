// Realistic CS-style arsenal.
// Damage/armour-penetration figures follow Counter-Strike reference values.
// Fire rates are divided by PACE because this build runs at roughly a third of
// CS tempo (half-scale operators, ~1.6 m/s run) -- keeping the ratio between
// guns intact is what makes them feel like the originals.
import {buildAK47,buildM4A1,buildAWP,buildDeagle,buildGlock,buildUSP,buildMP9,buildNova,buildKnife,
        buildMP5,buildFamas,buildAUG,buildNegev,buildRevolver,
        buildGaussRifle,buildGravityGun,buildBouncer} from '../render/viewmodels.js';

const PACE=3.0;
const rpm=r=>+(60/r*PACE).toFixed(3);   // rounds/min -> seconds between shots

export const WEAPONS={
  glock:{
    id:"glock",name:"GLOCK-18",short:"GLOCK",slot:2,classType:"hitscan",price:0,team:2,
    damage:30,headMult:4,armorPen:.47,range:90,falloff:[22,52,.55],
    fireRate:rpm(400),mag:20,reserve:120,reload:2.2,
    spread:.010,bloomPer:.006,bloomMax:.075,bloomDecay:.55,adsSpreadMult:.55,
    recoil:{pitch:.0090,yaw:.0040,kick:.10,shake:.09},
    adsFov:62,tracerColor:0xffd9a0,
    aiRange:[4,22],snd:"shot_pistol",vm:buildGlock},

  usp:{
    id:"usp",name:"USP-S",short:"USP",slot:2,classType:"hitscan",price:0,team:1,
    damage:35,headMult:4,armorPen:.505,range:100,falloff:[26,60,.6],
    fireRate:rpm(353),mag:12,reserve:24,reload:2.2,
    spread:.008,bloomPer:.005,bloomMax:.065,bloomDecay:.6,adsSpreadMult:.5,
    recoil:{pitch:.0085,yaw:.0032,kick:.10,shake:.08},
    adsFov:62,tracerColor:0xffd9a0,silenced:true,
    aiRange:[4,24],snd:"shot_pistol_sil",vm:buildUSP},

  deagle:{
    id:"deagle",name:"DESERT EAGLE",short:"DEAGLE",slot:2,classType:"hitscan",price:700,
    damage:63,headMult:4,armorPen:.93,range:130,falloff:[36,80,.7],
    fireRate:rpm(267),mag:7,reserve:35,reload:2.2,
    spread:.011,bloomPer:.020,bloomMax:.12,bloomDecay:.42,adsSpreadMult:.34,
    recoil:{pitch:.0260,yaw:.0075,kick:.30,shake:.30},
    adsFov:58,tracerColor:0xffc27a,
    aiRange:[5,34],snd:"shot_deagle",vm:buildDeagle},

  mp9:{
    id:"mp9",name:"MP9",short:"MP9",slot:1,classType:"hitscan",price:1250,
    damage:26,headMult:4,armorPen:.60,range:90,falloff:[18,46,.5],
    fireRate:rpm(857),mag:30,reserve:120,reload:2.1,
    spread:.011,bloomPer:.0040,bloomMax:.062,bloomDecay:.30,adsSpreadMult:.6,
    recoil:{pitch:.0052,yaw:.0026,kick:.07,shake:.06},
    adsFov:64,tracerColor:0xffd9a0,
    aiRange:[3,20],snd:"shot_smg",vm:buildMP9},

  nova:{
    id:"nova",name:"NOVA",short:"NOVA",slot:1,classType:"hitscan",price:1050,
    pellets:9,damage:26,headMult:1.5,armorPen:.50,range:42,falloff:[9,28,.25],pelletKnock:1.1,
    fireRate:rpm(68),mag:8,reserve:32,reload:2.6,shellReload:true,
    spread:.055,bloomPer:0,bloomMax:.055,bloomDecay:.4,adsSpreadMult:.78,
    recoil:{pitch:.0330,yaw:.0090,kick:.34,shake:.40},
    adsFov:66,tracerColor:0xffcf90,
    aiRange:[2,10],snd:"shot_shotgun",vm:buildNova},

  ak47:{
    id:"ak47",name:"AK-47",short:"AK",slot:1,classType:"hitscan",price:2700,team:2,
    damage:36,headMult:4,armorPen:.775,range:140,falloff:[42,95,.72],
    fireRate:rpm(600),mag:30,reserve:90,reload:2.4,
    spread:.0075,bloomPer:.0052,bloomMax:.088,bloomDecay:.26,adsSpreadMult:.30,
    recoil:{pitch:.0115,yaw:.0048,kick:.13,shake:.11},
    // CS spray pattern: hard vertical climb for ~8 rounds, then it walks L/R.
    pattern:[[0,1],[0,1],[0,1],[-.15,.95],[-.35,.85],[-.5,.7],[-.35,.55],[.1,.45],
             [.55,.4],[.8,.35],[.7,.3],[.35,.3],[-.15,.3],[-.6,.3],[-.85,.3],
             [-.7,.28],[-.3,.28],[.2,.28],[.65,.28],[.85,.26]],
    adsFov:56,tracerColor:0xffd9a0,
    aiRange:[8,45],snd:"shot_rifle",vm:buildAK47},

  m4a1:{
    id:"m4a1",name:"M4A1-S",short:"M4",slot:1,classType:"hitscan",price:2900,team:1,
    damage:33,headMult:4,armorPen:.70,range:140,falloff:[45,100,.75],
    fireRate:rpm(666),mag:25,reserve:75,reload:3.1,
    spread:.0062,bloomPer:.0042,bloomMax:.072,bloomDecay:.30,adsSpreadMult:.28,
    recoil:{pitch:.0088,yaw:.0034,kick:.10,shake:.085},
    pattern:[[0,1],[0,1],[0,.95],[-.1,.85],[-.25,.7],[-.35,.55],[-.2,.45],[.15,.4],
             [.45,.35],[.6,.32],[.45,.3],[.15,.3],[-.2,.28],[-.45,.28],[-.6,.26],
             [-.45,.26],[-.15,.24],[.2,.24],[.45,.24],[.6,.22]],
    adsFov:56,tracerColor:0xffd9a0,silenced:true,
    aiRange:[8,48],snd:"shot_rifle_sil",vm:buildM4A1},

  awp:{
    id:"awp",name:"AWP",short:"AWP",slot:1,classType:"hitscan",price:4750,
    damage:115,headMult:1.5,armorPen:.975,range:250,falloff:null,pierce:true,
    fireRate:1.5,mag:5,reserve:30,reload:3.7,boltAction:true,
    spread:.0008,bloomPer:.060,bloomMax:.16,bloomDecay:.34,adsSpreadMult:.02,
    recoil:{pitch:.0300,yaw:.0060,kick:.42,shake:.36},
    adsFov:22,scope:true,scopeLevels:[40,10],unscopeOnFire:false,
    adsSens:.30,          // heavy glass -- deliberately slow to track with
    tracerColor:0xfff0c0,
    aiRange:[16,90],snd:"shot_awp",vm:buildAWP},

  // --- additional service weapons -----------------------------------------
  mp5:{
    id:"mp5",name:"MP5-SD",short:"MP5",slot:1,classType:"hitscan",price:1500,
    damage:27,headMult:4,armorPen:.615,range:95,falloff:[20,50,.55],
    fireRate:rpm(800),mag:30,reserve:120,reload:2.4,
    spread:.0090,bloomPer:.0038,bloomMax:.058,bloomDecay:.32,adsSpreadMult:.5,
    recoil:{pitch:.0046,yaw:.0022,kick:.06,shake:.05},
    adsFov:63,tracerColor:0xffd9a0,silenced:true,
    aiRange:[3,24],snd:"shot_rifle_sil",vm:buildMP5},

  famas:{
    id:"famas",name:"FAMAS",short:"FAMAS",slot:1,classType:"hitscan",price:2050,team:1,
    damage:30,headMult:4,armorPen:.70,range:130,falloff:[40,90,.70],
    fireRate:rpm(666),mag:25,reserve:90,reload:3.3,
    spread:.0070,bloomPer:.0046,bloomMax:.078,bloomDecay:.28,adsSpreadMult:.30,
    recoil:{pitch:.0095,yaw:.0038,kick:.11,shake:.09},
    pattern:[[0,1],[0,1],[-.1,.9],[-.25,.75],[-.35,.6],[-.2,.5],[.15,.42],
             [.45,.36],[.55,.32],[.4,.3],[.1,.28],[-.25,.28],[-.5,.26]],
    adsFov:57,tracerColor:0xffd9a0,
    aiRange:[8,42],snd:"shot_rifle",vm:buildFamas},

  aug:{
    id:"aug",name:"AUG",short:"AUG",slot:1,classType:"hitscan",price:3300,team:1,
    damage:28,headMult:4,armorPen:.90,range:150,falloff:[48,105,.78],
    fireRate:rpm(666),mag:30,reserve:90,reload:3.8,
    spread:.0058,bloomPer:.0040,bloomMax:.068,bloomDecay:.32,adsSpreadMult:.18,
    recoil:{pitch:.0082,yaw:.0030,kick:.09,shake:.08},
    pattern:[[0,1],[0,.95],[-.1,.85],[-.2,.7],[-.3,.55],[-.15,.45],[.15,.4],
             [.4,.34],[.5,.3],[.35,.28],[.05,.26],[-.25,.26]],
    adsFov:38,scope:true,adsSens:.62,tracerColor:0xffd9a0,
    aiRange:[10,60],snd:"shot_rifle",vm:buildAUG},

  negev:{
    id:"negev",name:"NEGEV",short:"NEGEV",slot:1,classType:"hitscan",price:1700,
    damage:35,headMult:4,armorPen:.75,range:130,falloff:[38,90,.65],
    fireRate:rpm(1000),mag:150,reserve:200,reload:5.7,
    // Wildly inaccurate until you have been holding the trigger for a while.
    spread:.030,bloomPer:.0016,bloomMax:.10,bloomDecay:.10,adsSpreadMult:.5,
    spinUp:.9,
    recoil:{pitch:.0070,yaw:.0044,kick:.09,shake:.10},
    adsFov:60,tracerColor:0xffcf90,
    aiRange:[6,40],snd:"shot_rifle",vm:buildNegev},

  revolver:{
    id:"revolver",name:"R8 REVOLVER",short:"R8",slot:2,classType:"hitscan",price:600,
    damage:86,headMult:4,armorPen:.93,range:140,falloff:[40,95,.75],
    fireRate:rpm(200),mag:8,reserve:40,reload:2.6,
    spread:.008,bloomPer:.030,bloomMax:.14,bloomDecay:.40,adsSpreadMult:.20,
    recoil:{pitch:.0300,yaw:.0080,kick:.34,shake:.34},
    adsFov:52,tracerColor:0xffc27a,auto:false,
    aiRange:[6,45],snd:"shot_deagle",vm:buildRevolver},

  // --- sandbox ------------------------------------------------------------
  // Deliberately unrealistic. Flagged `sandbox` so the buy menu can group them
  // and a match can hide them.
  gauss:{
    id:"gauss",name:"GAUSS RIFLE",short:"GAUSS",slot:1,classType:"hitscan",price:5500,
    sandbox:true,
    damage:130,headMult:2,armorPen:1,range:300,pierce:true,
    fireRate:1.1,mag:6,reserve:24,reload:3.0,
    spread:.0006,bloomPer:.040,bloomMax:.10,bloomDecay:.5,adsSpreadMult:.05,
    recoil:{pitch:.0260,yaw:.0040,kick:.38,shake:.34},
    adsFov:34,scope:true,adsSens:.38,tracerColor:0x35d6ff,
    aiRange:[14,90],snd:"shot_awp",vm:buildGaussRifle},

  gravgun:{
    id:"gravgun",name:"GRAVITY PROJECTOR",short:"GRAV",slot:1,classType:"hitscan",price:4200,
    sandbox:true,
    damage:18,headMult:1.2,armorPen:.5,range:34,
    // Barely hurts; the point is the shove.
    launch:16, launchUp:7,
    fireRate:.62,mag:20,reserve:60,reload:2.4,
    spread:.020,bloomPer:.004,bloomMax:.06,bloomDecay:.5,adsSpreadMult:.6,
    recoil:{pitch:.0090,yaw:.0030,kick:.16,shake:.14},
    adsFov:64,tracerColor:0xb18cff,
    aiRange:[3,16],snd:"shot_smg",vm:buildGravityGun},

  bouncer:{
    id:"bouncer",name:"BOUNCE CANNON",short:"BOUNCE",slot:1,classType:"hitscan",price:3800,
    sandbox:true,
    pellets:3,damage:22,headMult:2,armorPen:.7,range:120,
    ricochet:3,                       // shots bounce off walls this many times
    fireRate:.55,mag:12,reserve:48,reload:2.6,
    spread:.030,bloomPer:.006,bloomMax:.09,bloomDecay:.4,adsSpreadMult:.6,
    recoil:{pitch:.0150,yaw:.0060,kick:.22,shake:.20},
    adsFov:64,tracerColor:0xffe14d,
    aiRange:[4,30],snd:"shot_shotgun",vm:buildBouncer},

  knife:{
    id:"knife",name:"KNIFE",short:"KNIFE",slot:3,classType:"melee",price:0,
    damage:42,headMult:1.6,armorPen:.85,range:1.2,backstab:3.2,
    fireRate:.42,mag:1,reserve:0,reload:0,
    spread:0,bloomPer:0,bloomMax:0,bloomDecay:1,adsSpreadMult:1,
    recoil:{pitch:.004,yaw:.002,kick:.06,shake:.05},
    adsFov:70,tracerColor:0xffffff,
    aiRange:[0,1.6],snd:"knife_slash",vm:buildKnife}
};

export const WEAPON_ORDER=["ak47","m4a1","famas","aug","awp","negev","mp9","mp5","nova",
  "deagle","revolver","glock","usp","gauss","gravgun","bouncer","knife"];

// Buy-menu columns, CS layout.
export const BUY_CATEGORIES=[
  {id:"pistols",label:"PISTOLS",items:["deagle","revolver","glock","usp"]},
  {id:"midtier",label:"MID-TIER",items:["mp9","mp5","nova","negev"]},
  {id:"rifles",label:"RIFLES",items:["ak47","m4a1","famas","aug","awp"]},
  {id:"gear",label:"EQUIPMENT",items:["kevlar","kevlar_helmet","defuser"]},
  {id:"nades",label:"GRENADES",items:["he","flash","smoke","molotov"]},
  {id:"sandbox",label:"SANDBOX",sandbox:true,items:["gauss","gravgun","bouncer"]}
];

export const GEAR={
  kevlar:{id:"kevlar",name:"KEVLAR VEST",price:650,armour:100,helmet:false},
  kevlar_helmet:{id:"kevlar_helmet",name:"KEVLAR + HELMET",price:1000,armour:100,helmet:true},
  defuser:{id:"defuser",name:"DEFUSE KIT",price:400,team:1}
};

export const NADE_DEFS={
  he:{name:"HE GRENADE",short:"HE",price:300,color:0x5b6b3a,fuse:1.7,max:1},
  flash:{name:"FLASHBANG",short:"FLASH",price:200,color:0x9aa4ad,fuse:1.6,max:2},
  smoke:{name:"SMOKE",short:"SMOKE",price:300,color:0x6f7d86,fuse:1.2,max:1},
  molotov:{name:"MOLOTOV",short:"MOLLY",price:400,color:0xb5622a,fuse:0,max:1,
           ctId:"incendiary",ctName:"INCENDIARY",ctPrice:600}
};
export const NADE_ORDER=["he","flash","smoke","molotov"];

// Default sidearm by team -- CS gives you a free pistol every pistol round.
export function defaultPistol(team){return team===1?"usp":"glock"}

/**
 * Counter-Strike armour model. Armour does not add effective HP -- it scales
 * incoming damage by the weapon's penetration value and degrades as it absorbs.
 * Helmets only protect the head.
 * @returns {{health:number, armour:number}} damage dealt to each pool
 */
export function armourSplit(dmg,cfg,armour,helmet,isHead){
  if(armour<=0) return {health:dmg,armour:0};
  if(isHead&&!helmet) return {health:dmg,armour:0};
  const pen=cfg&&cfg.armorPen!==undefined?cfg.armorPen:.75;
  const toHealth=dmg*pen;
  const absorbed=dmg-toHealth;
  return {health:toHealth,armour:Math.min(armour,absorbed*.5)};
}

/**
 * CS slot layout: [0] primary, [1] pistol, [2] knife.
 * A null primary means the operator is on a pistol round and slot 0 is empty.
 */
export function standardLoadout(team,primary){
  return [primary||null, defaultPistol(team), "knife"];
}

/** Cheapest sensible primary a bot can afford, by tier. */
export function botPickPrimary(money,team){
  if(money>=4750&&Math.random()<.18)return "awp";
  if(money>=2900)return team===1?"m4a1":"ak47";
  if(money>=2700&&team===2)return "ak47";
  if(money>=1250)return Math.random()<.5?"mp9":"nova";
  if(money>=1050)return "nova";
  return null;
}
