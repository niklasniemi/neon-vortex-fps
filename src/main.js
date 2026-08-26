// Boot: construct the systems, publish them into the live-binding registry,
// then hand control to the engine loop.
import {SETTINGS,DIFFS} from './core/config.js';
import {U} from './core/util.js';
import * as G from './core/globals.js';
import {InputMgr} from './core/input.js';
import {AudioSynth} from './core/audio.js';
import {ParticleFX} from './render/particles.js';
import {GraphicsPipeline} from './render/pipeline.js';
import {PhysicsController} from './game/physics.js';
import {WPN} from './game/wpnsystem.js';
import {MatchController} from './game/match.js';
import {GameEngine} from './game/engine.js';
import {BotManager} from './entities/botmanager.js';
import {NetworkManager} from './net/netentities.js';
import {NET2} from './net/p2p.js';
import {UIManager} from './ui/hud.js';
import {Menu} from './ui/menu.js';
import {Pause} from './ui/pause.js';
import {ARENAS} from './world/maps.js';
import {groundYAt} from './world/arena.js';

function fatal(msg){
  const d=document.createElement("div");
  d.className="screen";
  d.innerHTML="<div class='panel pcol'><div class='phead'>ENGINE FAILURE</div>"+
              "<div style='font-size:12px;color:#ff8a94;max-width:560px'>"+msg+"</div></div>";
  document.getElementById("app").appendChild(d);
}

function boot(){
  if(!window.THREE)return fatal("Three.js failed to load from the CDN. Check your connection and reload.");
  if(!window.CANNON)return fatal("Cannon.js failed to load from the CDN. Check your connection and reload.");

  try{
    G.setGFX(new GraphicsPipeline(document.getElementById("c3d")));
    G.setAUDIO(new AudioSynth());
    G.setINPUT(new InputMgr());
    G.setPHYS(new PhysicsController());
    G.setFX(new ParticleFX(G.GFX.scene));
    G.setUI(new UIManager());
    G.setWPN(WPN);
    G.setBOTMAN(new BotManager());
    G.setMATCH(new MatchController());
    G.setNET(new NetworkManager());
    G.setEngine(new GameEngine());

    // Honour a locked graphics tier from a previous session.
    if(SETTINGS.quality&&SETTINGS.quality!=="auto"&&G.GFX.quality)
      G.GFX.quality.lock(SETTINGS.quality);

    // Host mirrors its own HUD events to the guest so both see the same feed.
    const UI=G.UI;
    const mirror=(fn,wrap)=>{
      const orig=UI[fn].bind(UI);
      UI[fn]=(...a)=>{orig(...a);if(NET2.isHost&&NET2.conn)NET2.uiQ.push(wrap(a))};
    };
    mirror("announce",a=>({e:"ann",m:a[0],s:a[1]}));
    mirror("feedRaw", a=>({e:"feed",html:a[0],me:a[1]}));
    mirror("objShow", a=>({e:"obj",t:a[0],b:a[1]}));
    mirror("progShow",a=>({e:"prog",l:a[0],f:a[1]}));
    mirror("progHide",()=>({e:"progh"}));
    mirror("toast",   a=>({e:"toast",t:a[0]}));
    mirror("hitmark", a=>({e:"hm",k:a[0],h:a[1]}));
    mirror("endTimer",a=>({e:"et",s:a[0]}));

    window.engine=G.engine;
    // Debug handle -- handy from the console, not used by the game itself.
    window.NV={
      get MATCH(){return G.MATCH}, get WORLD(){return G.WORLD}, get UI(){return G.UI},
      get BOTMAN(){return G.BOTMAN}, get GFX(){return G.GFX}, get PHYS(){return G.PHYS},
      get FX(){return G.FX}, get WPN(){return G.WPN}, get INPUT(){return G.INPUT},
      get AUDIO(){return G.AUDIO}, get NET(){return G.NET},
      get SET(){return SETTINGS}, get DIFFS(){return DIFFS}, get NET2(){return NET2},
      get ARENAS(){return ARENAS}, get combatants(){return G.engine.combatants},
      groundYAt
    };

    G.engine.state="menu";
    G.UI.showMenu(true);

    addEventListener("keydown",e=>{
      const eng=G.engine, UI=G.UI;
      if(e.code==="Escape"&&UI&&UI.buyOpen){UI.toggleBuy(false);return}
      if(e.code==="Tab"&&eng.state==="playing"){e.preventDefault();UI.scoreboard(true)}

      // Menus own the keyboard while they are up. Note there is deliberately no
      // "Escape twice quits" path any more -- abandoning a match always goes
      // through the confirmation on the pause screen.
      if(eng.state==="playing"&&eng.paused){
        if(Pause.handleKey(e)){e.preventDefault();return}
        if(e.code==="Escape"){e.preventDefault();eng.pause(false);return}
        return;
      }
      if(eng.state==="menu"&&Menu.handleKey(e)){e.preventDefault();return}
    });
    addEventListener("keyup",e=>{if(e.code==="Tab")G.UI.scoreboard(false)});

    G.GFX.renderer.domElement.addEventListener("click",()=>{
      const eng=G.engine;
      if(eng.state==="playing"&&!eng.paused&&!G.INPUT.locked)G.INPUT.lock(G.GFX.renderer.domElement);
    });

    G.engine.loop();
  }catch(err){
    console.error(err);
    fatal("Boot error: "+(err&&err.message||err)+"<br><br><small>"+((err&&err.stack)||"").split("\n").slice(0,4).join("<br>")+"</small>");
  }
}

if(document.readyState==="complete")boot();
else addEventListener("load",boot);
