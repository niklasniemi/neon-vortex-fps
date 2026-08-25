import {SETTINGS} from './config.js';
import {UI,engine,MATCH,GFX,INPUT} from './globals.js';

export class InputMgr{
constructor(){
this.keys={};this.pressQ={};this.btn=[false,false,false];this.mdx=0;this.mdy=0;this.wheelAcc=0;this.locked=false;this.anyGesture=false;
addEventListener("keydown",e=>{
if(["Space","Tab","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
if(!e.repeat)this.pressQ[e.code]=true;
this.keys[e.code]=true;this.anyGesture=true;});
addEventListener("keyup",e=>{this.keys[e.code]=false});
addEventListener("mousedown",e=>{if(e.target.closest(".screen")||e.target.closest("button")||e.target.closest("input")||e.target.closest("#buywrap")||(UI&&UI.buyOpen))return;this.btn[e.button]=true;this.anyGesture=true;
if(engine&&engine.state==="playing"&&!this.locked&&!engine.paused)INPUT.lock(GFX.renderer.domElement);});
addEventListener("mouseup",e=>{this.btn[e.button]=false});
addEventListener("mousemove",e=>{if(this.locked){this.mdx+=e.movementX||0;this.mdy+=e.movementY||0}});
addEventListener("wheel",e=>{if(engine&&engine.state==="playing")this.wheelAcc+=Math.sign(e.deltaY)},{passive:true});
document.addEventListener("contextmenu",e=>{if(engine&&engine.state==="playing")e.preventDefault()});
document.addEventListener("pointerlockchange",()=>{
this.locked=document.pointerLockElement===GFX.renderer.domElement;
if(this.locked)this.hadLock=true;
if(!this.locked&&this.hadLock&&engine&&engine.state==="playing"&&!engine.paused&&!MATCH.endPending&&!(UI&&UI.buyOpen))engine.pause(true);});
}
lock(el){if(el.requestPointerLock)el.requestPointerLock()}
unlock(){if(document.exitPointerLock)document.exitPointerLock()}
press(c){if(this.pressQ[c]){this.pressQ[c]=false;return true}return false}
consumeMouse(){const r={dx:this.mdx,dy:this.mdy};this.mdx=0;this.mdy=0;return r}
takeWheel(){const w=this.wheelAcc;this.wheelAcc=0;return w}
frameClear(){for(const k in this.pressQ)this.pressQ[k]=false;this.mdx=0;this.mdy=0;this.wheelAcc=0}
}
