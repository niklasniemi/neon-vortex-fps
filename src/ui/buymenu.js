// Buy menu -- a category grid, not the old radial wheel.
import {SETTINGS} from '../core/config.js';
import {AUDIO,INPUT,GFX,UI,MATCH,engine} from '../core/globals.js';
import {WEAPONS,NADE_DEFS,GEAR,BUY_CATEGORIES} from '../game/weapons.js';
import {applyBuy,buyBlocked,priceOf,displayName} from '../game/economy.js';
import {NET2} from '../net/p2p.js';

const $=id=>document.getElementById(id);

/** Simple line-art icon per item, drawn into the tile canvas. */
function drawIcon(g,id){
  g.clearRect(0,0,96,54);
  g.strokeStyle="#cfe0ea";g.fillStyle="#cfe0ea";
  g.lineWidth=2.4;g.lineCap="round";g.lineJoin="round";
  const L=(x1,y1,x2,y2)=>{g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke()};
  const R=(x,y,w,h)=>g.fillRect(x,y,w,h);

  switch(id){
    case"ak47": case"m4a1":
      L(10,28,64,28); L(64,28,86,28);
      R(24,28,16,10); R(44,20,8,8);
      L(52,36,60,44);
      break;
    case"awp":
      L(6,30,90,30);
      R(30,20,26,7);                        // scope
      R(20,30,14,9);
      L(56,38,64,46);
      break;
    case"mp9":
      L(14,28,58,28);
      R(26,28,12,14); R(40,22,8,7);
      break;
    case"nova":
      L(10,26,84,26); L(10,32,84,32);
      R(22,32,18,8);
      break;
    case"deagle":
      R(28,20,34,11); L(30,31,30,44); R(26,31,10,16);
      break;
    case"glock": case"usp":
      R(30,22,28,9); R(28,31,9,14);
      if(id==="usp")L(58,26,78,26);
      break;
    case"kevlar":
      g.beginPath();g.moveTo(48,12);g.lineTo(70,20);g.lineTo(66,44);
      g.lineTo(48,50);g.lineTo(30,44);g.lineTo(26,20);g.closePath();g.stroke();
      break;
    case"kevlar_helmet":
      g.beginPath();g.moveTo(48,10);g.lineTo(70,20);g.lineTo(66,42);
      g.lineTo(48,48);g.lineTo(30,42);g.lineTo(26,20);g.closePath();g.stroke();
      g.beginPath();g.arc(48,20,11,Math.PI,0);g.stroke();
      break;
    case"defuser":
      R(32,20,32,20);
      L(40,40,40,48); L(56,40,56,48);
      g.beginPath();g.arc(48,30,5,0,7);g.stroke();
      break;
    case"he":
      g.beginPath();g.arc(48,32,12,0,7);g.fill();
      R(44,12,8,10);
      break;
    case"flash":
      g.beginPath();g.arc(48,34,10,0,7);g.fill();
      R(44,12,8,14);
      L(30,18,22,12); L(66,18,74,12);
      break;
    case"smoke":
      g.strokeRect(38,18,20,30);
      R(42,12,12,6);
      g.beginPath();g.arc(48,33,4,0,7);g.fill();
      break;
    case"molotov":
      g.beginPath();g.arc(48,36,12,0,7);g.fill();
      R(44,12,8,14);
      g.fillStyle="#ff9a3c";g.beginPath();g.arc(48,10,5,0,7);g.fill();
      break;
    default:
      g.strokeRect(30,20,36,20);
  }
}

export const BuyMenu={
  open:false,

  toggle(force){
    const wrap=$("buywrap");
    const want=force!==undefined?force:!this.open;
    const p=engine.player;

    if(want){
      if(!p||!MATCH.canBuy(p)){
        UI.toast(MATCH.mode.roundPhase==="live"
          ? "BUY WINDOW CLOSED — RETURN TO SPAWN BEFORE MOVING"
          : "CANNOT BUY RIGHT NOW");
        return;
      }
    }
    this.open=want;
    UI.buyOpen=want;
    wrap.classList.toggle("hidden",!want);
    INPUT.btn[0]=false;INPUT.btn[2]=false;
    if(want){
      if(INPUT.locked)INPUT.unlock();
      this.build();
    }else if(engine.state==="playing"&&!engine.paused){
      INPUT.lock(GFX.renderer.domElement);
    }
  },

  build(){
    const p=engine.player;
    const root=$("buygrid");
    if(!root||!p)return;
    root.innerHTML="";

    for(const cat of BUY_CATEGORIES){
      const col=document.createElement("div");
      col.className="buycol";
      const h=document.createElement("div");
      h.className="buyhead";h.textContent=cat.label;
      col.appendChild(h);

      for(const id of cat.items){
        // Hide the other team's exclusive weapons rather than showing them dead.
        const w=WEAPONS[id];
        if(w&&w.team&&w.team!==p.team)continue;
        if(GEAR[id]&&GEAR[id].team&&GEAR[id].team!==p.team)continue;

        const price=priceOf(id,p.team);
        const blocked=buyBlocked(p,id);
        const tile=document.createElement("button");
        tile.className="buytile"+(blocked?" blocked":"");
        tile.disabled=!!blocked;

        const cv=document.createElement("canvas");
        cv.width=96;cv.height=54;
        drawIcon(cv.getContext("2d"),id);

        const nm=document.createElement("div");
        nm.className="bname";nm.textContent=displayName(id,p.team);

        const pr=document.createElement("div");
        pr.className="bprice";
        pr.textContent=blocked&&blocked!=="NO FUNDS"?blocked:"$"+price;
        if(blocked==="NO FUNDS")pr.classList.add("cant");

        tile.append(cv,nm,pr);
        tile.onclick=()=>{
          if(!applyBuy(p,id)){AUDIO.play("dry",{ui:true});return}
          AUDIO.play("buy",{ui:true});
          if(NET2.joined&&NET2.conn&&NET2.conn.open)NET2.conn.send({t:"buy",item:id});
          UI.moneyHud(p);
          this.build();
        };
        col.appendChild(tile);
      }
      root.appendChild(col);
    }

    const money=$("buymoney");
    if(money)money.textContent="$"+Math.floor(p.money||0);
    const timer=$("buytimer");
    if(timer){
      const m=MATCH.mode;
      const left=m.roundPhase==="freeze"?m.phaseT:(m.buyT||0);
      timer.textContent=left>0?("BUY TIME "+Math.ceil(left)+"s"):"IN SPAWN ONLY";
    }
  },

  /** Refresh the countdown while the menu is open. */
  tick(){
    if(!this.open)return;
    const p=engine.player;
    if(!p||!MATCH.canBuy(p)){this.toggle(false);return}
    const timer=$("buytimer");
    if(timer){
      const m=MATCH.mode;
      const left=m.roundPhase==="freeze"?m.phaseT:(m.buyT||0);
      timer.textContent=left>0?("BUY TIME "+Math.ceil(left)+"s"):"IN SPAWN ONLY";
    }
  }
};
