// Tuning constants and persisted user settings.
// Movement numbers are scaled CS:GO reference values: the operator model is
// roughly half human scale, so world-space speeds are ~1/3 of the CS metres/sec
// figures while the *ratios* between walk/run/crouch match the source game.
export const CFG={
  grav:-15.5,
  jump:2.72,          // apex ~0.66m at charGravScale .35 -> CS-like 64u hop
  charGravScale:.35,  // characters fall slower than projectiles (floaty arc)
  walk:1.63,          // full run
  sprint:.87,         // shift-walk (silent, slower) -- CS has no sprint
  crouchSpd:.6,
  accelG:10,accelA:30,fric:6,airWish:.5,
  eyeH:.95,crouchEye:.55,
  feetOff:.42,radius:.22,
  standHeight:1.38,   // clearance needed to stand in a span
  crouchHeight:.82,   // clearance needed to crouch through a gap
  stepMax:.35         // max ledge auto-stepped without jumping
};

export const GRP={WORLD:1,CHAR:2,PROJ:4,SHIELD:8};
export const TEAM_HEX={1:0x8fb3d9,2:0xd9a441};
export const TEAM_CSS={1:"#8fb3d9",2:"#d9a441"};
export const TEAM_NAME={1:"COUNTER-TERRORISTS",2:"TERRORISTS"};
export const TEAM_SHORT={1:"CT",2:"T"};

// Health/armour regeneration. The arcade build refilled armour at 22/s after a
// 4s lull, which erased every trade. These are deliberately slow so a fight you
// win still costs you something going into the next one.
export const REGEN={delay:9,rate:3.5,armourOnly:true};

export const DIFFS={
  novice:{label:"NOVICE",react:.78,err:.14,turn:1.6,dmg:.5,distErr:.085,burst:[2,3],burstPause:[.8,1.6]},
  standard:{label:"STANDARD",react:.52,err:.088,turn:2.5,dmg:.66,distErr:.05,burst:[3,5],burstPause:[.5,1.05]},
  hardcore:{label:"HARDCORE",react:.34,err:.052,turn:3.6,dmg:.84,distErr:.03,burst:[4,7],burstPause:[.35,.7]},
  nightmare:{label:"NIGHTMARE",react:.2,err:.028,turn:5.4,dmg:1,distErr:.017,burst:[5,10],burstPause:[.2,.4]}
};

export const BOT_NAMES=["Volkov","Reznik","Sabre","Ortega","Dax","Hale","Kovac","Mikkel",
  "Rook","Salvo","Tero","Vance","Ash","Brandt","Cairo","Dubois"];

export function loadSettings(){try{return JSON.parse(localStorage.getItem("nv_settings")||"{}")}catch(e){return{}}}

export const SETTINGS=Object.assign({
  name:"OPERATOR-"+(100+Math.floor(Math.random()*899)),
  sens:1,adsSens:.85,fov:80,vol:.8,invert:false,diff:"standard",
  shake:1,bob:1,bloomAmt:1,autoReload:true,
  vmSide:1,vmX:0,vmY:0,
  crossColor:"#4fe3ff",crossSize:1,crossDot:true,
  dmgNumbers:true,grain:true,ca:true,mmRotate:true,ff:false,
  teamSize:5,side:"ct"
},loadSettings());

export function saveSettings(){try{localStorage.setItem("nv_settings",JSON.stringify(SETTINGS))}catch(e){}}

// Counter-Strike kill rewards. Rifles pay the standard 300; SMGs and shotguns
// pay more to make an eco round worth committing to, and the AWP pays less.
export const KILL_REWARD={
  ak47:300,m4a1:300,awp:100,
  mp9:600,nova:900,
  deagle:300,glock:300,usp:300,
  knife:1500
};

// Round-end payouts.
export const ECONOMY={
  winRound:3250,
  winByBomb:3500,
  winByDefuse:3500,
  plantBonus:300,        // to every T, even on a loss
  defuseBonus:300,
  lossStreak:[1400,1900,2400,2900,3400],   // grows each consecutive loss
  maxMoney:16000,
  startMoney:800,
  pistolRoundMoney:800
};

