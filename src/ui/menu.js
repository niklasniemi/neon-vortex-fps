// Front-end navigation.
//
// The old menu put callsign, ruleset, arena, bot skill, lobby size, side,
// loadout, eight sliders and the P2P controls on one screen at once. This is a
// stack of small screens instead: you pick Single Player / Online / Settings,
// and each step only shows what that step needs.
import {SETTINGS,saveSettings,DIFFS,TEAM_NAME} from '../core/config.js';
import {U} from '../core/util.js';
import {AUDIO,GFX,UI,engine} from '../core/globals.js';
import {ARENAS,DEFAULT_MAP} from '../world/maps.js';
import {NET2} from '../net/p2p.js';
import {MenuBackground} from './background.js';
import {Nav} from './nav.js';

const $=id=>document.getElementById(id);

export const Menu={
  stack:["root"],
  bg:null,

  init(){
    const cv=$("menubg");
    if(cv){this.bg=new MenuBackground(cv);this.bg.start()}
    // Audio needs a gesture before it will start; kick the score off on the
    // first interaction of any kind.
    const startMusic=()=>{
      if(!AUDIO)return;
      AUDIO.init();AUDIO.resume();
      if(engine.state==="menu")AUDIO.music("menu");
      removeEventListener("pointerdown",startMusic);
      removeEventListener("keydown",startMusic);
    };
    addEventListener("pointerdown",startMusic);
    addEventListener("keydown",startMusic);
    this.bindAll();
    this.go("root",true);
  },

  // --- navigation ---------------------------------------------------------
  go(id,replace){
    if(replace)this.stack=[id];
    else if(this.stack[this.stack.length-1]!==id)this.stack.push(id);
    this.render();
    AUDIO&&AUDIO.play("ui_click",{ui:true});
  },
  back(){
    if(this.stack.length>1)this.stack.pop();
    this.render();
    AUDIO&&AUDIO.play("ui_back",{ui:true});
  },
  current(){return this.stack[this.stack.length-1]},

  render(){
    const cur=this.current();
    document.querySelectorAll(".mscreen").forEach(el=>{
      el.classList.toggle("active",el.dataset.screen===cur);
    });
    const back=$("m-back");
    if(back)back.classList.toggle("hidden",this.stack.length<=1);
    if(cur==="lobby")Lobby.render();
    if(cur==="settings")this.syncSettings();

    // Point keyboard navigation at the visible screen. Escape steps back one
    // level, which is also the only reliable way out of a settings panel that
    // is taller than the window.
    const panel=document.querySelector('.mscreen[data-screen="'+cur+'"]');
    if(panel)Nav.attach(panel,()=>{if(this.stack.length>1)this.back()});
    else Nav.detach();
    const shell=document.querySelector(".menushell");
    if(shell)shell.scrollTop=0;
  },

  /** Key handling while the main menu is on screen. */
  handleKey(e){
    if(engine.state!=="menu")return false;
    if(e.code==="Escape"&&this.stack.length>1){this.back();return true}
    return Nav.handleKey(e);
  },

  // --- binding ------------------------------------------------------------
  bindAll(){
    const on=(id,fn)=>{const e=$(id);if(e)e.onclick=()=>{AUDIO&&AUDIO.init();fn()}};

    on("m-back",()=>this.back());
    on("nav-solo",()=>this.go("solo"));
    on("nav-online",()=>this.go("online"));
    on("nav-settings",()=>this.go("settings"));

    // --- callsign ---------------------------------------------------------
    const nm=$("in-name");
    if(nm){
      nm.value=SETTINGS.name;
      nm.oninput=()=>{SETTINGS.name=nm.value.trim().slice(0,14)||"OPERATOR";saveSettings()};
    }

    // --- single player ----------------------------------------------------
    this.seg("sel-diff",Object.entries(DIFFS).map(([k,d])=>[k,d.label]),
      ()=>SETTINGS.diff,v=>{SETTINGS.diff=v;saveSettings()});
    this.seg("sel-size",[[1,"1v1"],[2,"2v2"],[3,"3v3"],[4,"4v4"],[5,"5v5"]],
      ()=>SETTINGS.teamSize,v=>{SETTINGS.teamSize=+v;saveSettings()});
    this.seg("sel-side",[["ct","COUNTER-TERRORIST"],["t","TERRORIST"]],
      ()=>SETTINGS.side,v=>{SETTINGS.side=v;saveSettings()});

    on("btn-deploy",()=>{
      AUDIO.resume();
      NET2.lobby.started=true;
      const size=U.clamp(SETTINGS.teamSize,1,5);
      const you=SETTINGS.side==="ct"?1:2;
      const foe=you===1?2:1;
      // Solo: bots fill your side minus you, and the whole enemy side.
      NET2.lobby.hostTeam=you;
      NET2.lobby.bots[you]=size-1;
      NET2.lobby.bots[foe]=size;
      engine.deploy(DEFAULT_MAP,"defuse");
    });

    // --- online -----------------------------------------------------------
    on("btn-host",()=>{
      NET2.host(()=>{});
      NET2.lobby.hostTeam=SETTINGS.side==="ct"?1:2;
      NET2.lobby.bots={1:0,2:0};
      this.go("lobby");
    });
    on("btn-joinscreen",()=>this.go("join"));
    on("btn-join",()=>{
      const code=($("in-code").value||"").trim();
      if(!/^[0-9]{4}$/.test(code)){NET2.status("ENTER THE 4-DIGIT CODE",false);return}
      NET2.join(code,ok=>{if(ok)this.go("lobby")});
    });

    NET2.onLobby=()=>{if(this.current()==="lobby")Lobby.render()};
    NET2.onStart=()=>{AUDIO.resume();engine.deploy(DEFAULT_MAP,"defuse")};

    Lobby.bind();
    this.bindSettings();
  },

  /** Renders a segmented control and keeps it in sync with its getter. */
  seg(id,items,get,set){
    const el=$(id);
    if(!el)return;
    const draw=()=>{
      el.innerHTML="";
      const cur=String(get());
      for(const [val,label] of items){
        const b=document.createElement("button");
        b.textContent=label;
        if(String(val)===cur)b.classList.add("on");
        b.onclick=()=>{AUDIO&&AUDIO.play("ui_click",{ui:true});set(val);draw()};
        el.appendChild(b);
      }
    };
    draw();
    el._redraw=draw;
  },

  // --- settings -----------------------------------------------------------
  bindSettings(){
    document.querySelectorAll("#settings .stab").forEach(tab=>{
      tab.onclick=()=>{
        AUDIO&&AUDIO.play("ui_click",{ui:true});
        document.querySelectorAll("#settings .stab").forEach(t=>t.classList.toggle("on",t===tab));
        document.querySelectorAll("#settings .spane").forEach(p=>
          p.classList.toggle("active",p.dataset.pane===tab.dataset.tab));
      };
    });

    const range=(id,key,scale,labelId,fmt)=>{
      const el=$(id);if(!el)return;
      el.value=Math.round(SETTINGS[key]*scale);
      const lab=labelId?$(labelId):null;
      const paint=()=>{if(lab)lab.textContent=fmt?fmt(SETTINGS[key]):Math.round(SETTINGS[key]*100)+"%"};
      el.oninput=()=>{
        SETTINGS[key]=(+el.value)/scale;
        if(key==="vol"&&AUDIO)AUDIO.setVolume(SETTINGS.vol);
        paint();saveSettings();
      };
      paint();
    };
    range("rng-sens","sens",100,"sensval",v=>v.toFixed(2));
    range("rng-adssens","adsSens",100,"adssensval",v=>v.toFixed(2));
    range("rng-fov","fov",1,"fovval",v=>Math.round(v));
    range("rng-vol","vol",100,"volval");
    range("rng-shake","shake",100,"shakeval");
    range("rng-bob","bob",100,"bobval");
    range("rng-bloom","bloomAmt",100,"bloomval");
    range("rng-xsize","crossSize",100,"xsizeval");

    const col=$("in-xcolor");
    if(col){col.value=SETTINGS.crossColor;col.oninput=()=>{SETTINGS.crossColor=col.value;saveSettings()}}

    this.seg("sel-hand",[[1,"RIGHT"],[-1,"LEFT"]],()=>SETTINGS.vmSide,v=>{SETTINGS.vmSide=+v;saveSettings()});

    this.seg("sel-quality",
      [["auto","AUTO"],["low","LOW"],["medium","MED"],["high","HIGH"],["ultra","ULTRA"]],
      ()=>SETTINGS.quality,
      v=>{
        SETTINGS.quality=v;saveSettings();
        if(GFX&&GFX.quality){
          if(v==="auto")GFX.quality.unlock();
          else GFX.quality.lock(v);
        }
      });

    const toggles=[["tg-dmg","dmgNumbers","DAMAGE NUMBERS"],
                   ["tg-dot","crossDot","CROSSHAIR DOT"],
                   ["tg-ff","ff","FRIENDLY FIRE"],
                   ["tg-invert","invert","INVERT PITCH"],
                   ["tg-takeover","takeover","TAKE OVER A TEAM-MATE ON DEATH"],
                   ["tg-infammo","infAmmo","UNLIMITED AMMO"],
                   ["tg-infnades","infNades","UNLIMITED GRENADES"],
                   ["tg-infmoney","infMoney","UNLIMITED MONEY"]];
    for(const [id,key,label] of toggles){
      const el=$(id);if(!el)continue;
      const paint=()=>{el.textContent=label+"  "+(SETTINGS[key]?"ON":"OFF");el.classList.toggle("on",!!SETTINGS[key])};
      el.onclick=()=>{AUDIO&&AUDIO.play("ui_click",{ui:true});SETTINGS[key]=!SETTINGS[key];paint();saveSettings()};
      paint();
    }
  },

  syncSettings(){
    const s=$("sensval");if(s)s.textContent=SETTINGS.sens.toFixed(2);
  }
};

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------
export const Lobby={
  bind(){
    const on=(id,fn)=>{const e=$(id);if(e)e.onclick=()=>{AUDIO&&AUDIO.play("ui_click",{ui:true});fn()}};
    on("lb-start",()=>{
      if(!NET2.isHost&&NET2.connected)return;    // only the host starts
      AUDIO.resume();
      NET2.lobby.started=true;
      NET2.sendStart();
      engine.deploy(DEFAULT_MAP,"defuse");
    });
    on("lb-swap",()=>{
      NET2.setHostTeam(NET2.lobby.hostTeam===1?2:1);
      this.render();
    });
    on("lb-copy",()=>{
      const code=NET2.code;
      if(code&&navigator.clipboard)navigator.clipboard.writeText(code).then(
        ()=>UI&&UI.toast("ROOM CODE COPIED"),()=>{});
    });
    // Bot +/- per team.
    for(const team of [1,2]){
      const dec=$("lb-bot"+team+"-");
      const inc=$("lb-bot"+team+"+");
      if(dec)dec.onclick=()=>{AUDIO&&AUDIO.play("ui_click",{ui:true});NET2.setBots(team,(NET2.lobby.bots[team]|0)-1);this.render()};
      if(inc)inc.onclick=()=>{AUDIO&&AUDIO.play("ui_click",{ui:true});NET2.setBots(team,(NET2.lobby.bots[team]|0)+1);this.render()};
    }
  },

  render(){
    const L=NET2.lobby;
    const code=$("lb-code");
    if(code)code.textContent=NET2.code||"----";

    const host=NET2.isHost||!NET2.connected;
    const st=$("lb-conn");
    if(st){
      st.textContent=NET2.connected?"FRIEND CONNECTED":(NET2.isHost?"WAITING FOR A FRIEND…":"CONNECTING…");
      st.classList.toggle("ok",NET2.connected);
    }

    for(const team of [1,2]){
      const slotsEl=$("lb-team"+team);
      if(!slotsEl)continue;
      slotsEl.innerHTML="";

      const rows=[];
      if(L.hostTeam===team)rows.push({name:SETTINGS.name+(NET2.isHost?" (HOST)":""),kind:"you"});
      if(NET2.connected&&NET2.guestTeam()===team)
        rows.push({name:(NET2.guestName||"FRIEND"),kind:"friend"});
      for(let i=0;i<(L.bots[team]|0);i++)rows.push({name:"BOT "+(i+1),kind:"bot"});

      for(const r of rows){
        const d=document.createElement("div");
        d.className="lbslot "+r.kind;
        d.innerHTML="<i></i><span>"+r.name+"</span>";
        slotsEl.appendChild(d);
      }
      for(let i=rows.length;i<5;i++){
        const d=document.createElement("div");
        d.className="lbslot empty";
        d.innerHTML="<i></i><span>OPEN</span>";
        slotsEl.appendChild(d);
      }

      const cnt=$("lb-bot"+team+"n");
      if(cnt)cnt.textContent=String(L.bots[team]|0);
      for(const sfx of ["-","+"]){
        const b=$("lb-bot"+team+sfx);
        if(b)b.disabled=!host;
      }
    }

    const start=$("lb-start");
    if(start){
      start.disabled=!host;
      start.textContent=host?"START MATCH":"WAITING FOR HOST…";
    }
    const swap=$("lb-swap");
    if(swap)swap.disabled=!host;
  }
};
