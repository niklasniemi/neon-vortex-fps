// Live-binding service registry.
// The original build kept every system in one closure with mutable `let` slots.
// ES module live bindings reproduce that exactly: importers see the current
// value, so systems can reference each other without circular-import stalls.
export let GFX=null,PHYS=null,AUDIO=null,FX=null,INPUT=null,UI=null,WPN=null;
export let BOTMAN=null,MATCH=null,NET=null,WORLD=null,engine=null;

export function setGFX(v){GFX=v}
export function setPHYS(v){PHYS=v}
export function setAUDIO(v){AUDIO=v}
export function setFX(v){FX=v}
export function setINPUT(v){INPUT=v}
export function setUI(v){UI=v}
export function setWPN(v){WPN=v}
export function setBOTMAN(v){BOTMAN=v}
export function setMATCH(v){MATCH=v}
export function setNET(v){NET=v}
export function setWORLD(v){WORLD=v}
export function setEngine(v){engine=v}
