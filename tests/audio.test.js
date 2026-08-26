// Audio coverage: every sound the game asks for must actually exist.
//   import('/tests/audio.test.js').then(m=>console.table(m.run()))
import {SOUND_DEFS} from '/src/core/audio.js';
import {WEAPONS} from '/src/game/weapons.js';

const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

// Every name passed to AUDIO.play() anywhere in the source.
const PLAYED=["beep","buy","dry","explosion","firecrack","fireignite","flashpop","heboom",
  "hurt","jump","kill","knife_hit","land","nadebounce","pin","pk_ammo","pk_power",
  "reload1","reload2","smokehiss","spawn","step_dirt","ui_back","ui_click","hit","hit_head"];

export function run(){
  out.length=0;
  const V=window.NV, A=V.AUDIO;
  // A real page needs a user gesture first; initialise directly for the test.
  if(A&&!A.ctx)A.init();

  const missing=PLAYED.filter(n=>!SOUND_DEFS[n]);
  check("audio: every sound the game plays is defined",
    missing.length===0, missing.length?missing.join(", "):`${PLAYED.length} names`);

  const gunMissing=Object.values(WEAPONS).map(w=>w.snd).filter(n=>!SOUND_DEFS[n]);
  check("audio: every weapon has a firing sound",
    gunMissing.length===0, gunMissing.length?gunMissing.join(", "):"all present");

  // Structure: layers must be playable.
  const bad=[];
  for(const [name,def] of Object.entries(SOUND_DEFS)){
    if(!def.layers||!def.layers.length){bad.push(name+" (no layers)");continue}
    for(const L of def.layers){
      if(!(L.dur>0)){bad.push(name+" (bad duration)");break}
      if(L.t!=="n"&&!(L.f0>0)){bad.push(name+" (no frequency)");break}
      if(L.t==="n"&&L.nz&&!["white","pink","brown"].includes(L.nz)){bad.push(name+" (bad noise)");break}
    }
  }
  check("audio: every definition is well formed", bad.length===0,
    bad.length?bad.slice(0,4).join("; "):`${Object.keys(SOUND_DEFS).length} sounds`);

  // Gunfire should be layered, not a single beep -- that is what makes it read
  // as a firearm rather than a click.
  const guns=Object.values(WEAPONS).filter(w=>w.classType==="hitscan").map(w=>w.snd);
  const thin=guns.filter(n=>SOUND_DEFS[n]&&SOUND_DEFS[n].layers.length<3);
  check("audio: gunfire is layered (crack + body + tail)",
    thin.length===0, thin.length?thin.join(", "):`${guns.length} weapons`);

  // Suppressed weapons must be quieter than unsuppressed ones.
  const loud=SOUND_DEFS.shot_rifle, quiet=SOUND_DEFS.shot_rifle_sil;
  check("audio: suppressed fire is quieter",
    (quiet.v||1)<(loud.v||1)||quiet.layers[0].g0<loud.layers[0].g0,
    `${quiet.layers[0].g0} vs ${loud.layers[0].g0} transient`);

  // Engine capabilities.
  if(A&&A.ctx){
    check("audio: reverb bus is built", !!(A.conv&&A.conv.buffer),
      A.conv&&A.conv.buffer?`${A.conv.buffer.duration.toFixed(2)}s impulse`:"missing");
    check("audio: coloured noise is available",
      !!(A.noise&&A.noise.white&&A.noise.pink&&A.noise.brown), "white/pink/brown");
    check("audio: separate buses exist",
      !!(A.sfx&&A.ui&&A.amb&&A.mus), "sfx/ui/ambient/music");
    check("audio: music can start and stop", (()=>{
      try{A.music("menu");const on=!!A._music;A.stopMusic();return on}catch(e){return false}
    })(), "menu score");
  }else{
    check("audio: engine initialised", false, "no AudioContext (needs a gesture)");
  }
  return out;
}
