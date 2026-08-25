// Realistic CS-style arsenal.
// Damage/armour-penetration figures follow Counter-Strike reference values.
// Fire rates are divided by PACE because this build runs at roughly a third of
// CS tempo (half-scale operators, ~1.6 m/s run) -- keeping the ratio between
// guns intact is what makes them feel like the originals.
import {buildAK47,buildM4A1,buildAWP,buildDeagle,buildGlock,buildUSP,buildMP9,buildNova,buildKnife} from '../render/viewmodels.js';

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
    tracerColor:0xfff0c0,
    aiRange:[16,90],snd:"shot_awp",vm:buildAWP},

  knife:{
    id:"knife",name:"KNIFE",short:"KNIFE",slot:3,classType:"melee",price:0,
    damage:42,headMult:1.6,armorPen:.85,range:1.2,backstab:3.2,
    fireRate:.42,mag:1,reserve:0,reload:0,
    spread:0,bloomPer:0,bloomMax:0,bloomDecay:1,adsSpreadMult:1,
    recoil:{pitch:.004,yaw:.002,kick:.06,shake:.05},
    adsFov:70,tracerColor:0xffffff,
    aiRange:[0,1.6],snd:"knife_slash",vm:buildKnife}
};

export const WEAPON_ORDER=["ak47","m4a1","awp","mp9","nova","deagle","glock","usp","knife"];

// Buy-menu columns, CS layout.
export const BUY_CATEGORIES=[
  {id:"pistols",label:"PISTOLS",items:["deagle","glock","usp"]},
  {id:"midtier",label:"MID-TIER",items:["mp9","nova"]},
  {id:"rifles",label:"RIFLES",items:["ak47","m4a1","awp"]},
  {id:"gear",label:"EQUIPMENT",items:["kevlar","kevlar_helmet","defuser"]},
  {id:"nades",label:"GRENADES",items:["he","flash","smoke","molotov"]}
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
