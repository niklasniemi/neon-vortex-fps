// Pause screen: resume, full settings, and a guarded exit.
//
// Escape used to quit straight to the main menu on the second press, which is
// very easy to do by accident mid-match. Escape now only ever resumes or steps
// back one level; abandoning requires choosing it and then confirming.
import {AUDIO,INPUT,GFX,UI,engine} from '../core/globals.js';
import {Nav} from './nav.js';

const $=id=>document.getElementById(id);

export const Pause={
  view:"main",       // main | settings | confirm
  _settingsHome:null,

  bind(){
    const on=(id,fn)=>{const e=$(id);if(e)e.onclick=()=>{AUDIO&&AUDIO.play("ui_click",{ui:true});fn()}};
    on("btn-resume",()=>engine.pause(false));
    on("btn-pausesettings",()=>this.show("settings"));
    on("btn-settingsback",()=>this.show("main"));
    on("btn-quit",()=>this.show("confirm"));
    on("btn-confirmno",()=>this.show("main"));
    on("btn-confirmyes",()=>{this.show("main");engine.quitToMenu()});
  },

  /** Called whenever the pause overlay opens. */
  open(){
    this.show("main");
  },

  close(){
    // Always hand the settings panel back to the main menu.
    this.returnSettings();
    Nav.detach();
  },

  /** Moves the shared settings panel into the pause panel. */
  borrowSettings(){
    const panel=$("settings");
    const slot=$("pausesettingsslot");
    if(!panel||!slot||panel.parentElement===slot)return;
    this._settingsHome=panel.parentElement;
    slot.appendChild(panel);
    panel.classList.add("active");
  },

  returnSettings(){
    const panel=$("settings");
    if(!panel||!this._settingsHome)return;
    if(panel.parentElement!==this._settingsHome)this._settingsHome.appendChild(panel);
    panel.classList.remove("active");
    this._settingsHome=null;
  },

  show(view){
    this.view=view;
    if(view==="settings")this.borrowSettings();
    else this.returnSettings();

    $("pausemain").classList.toggle("hidden",view!=="main");
    $("pausesettings").classList.toggle("hidden",view!=="settings");
    $("pauseconfirm").classList.toggle("hidden",view!=="confirm");

    const root=view==="main"?$("pausemain"):view==="settings"?$("pausesettings"):$("pauseconfirm");
    Nav.attach(root,()=>this.back());
    if(view==="confirm"){
      // Land on CANCEL, so a stray Enter does not abandon the match.
      Nav.refresh();
      Nav.idx=Nav.items.indexOf($("btn-confirmno"));
      Nav.paint();
    }
  },

  /** Escape / Backspace behaviour, one level at a time. */
  back(){
    if(this.view==="main"){engine.pause(false);return}
    this.show("main");
    AUDIO&&AUDIO.play("ui_back",{ui:true});
  },

  /**
   * Enter confirms only on the confirm view; everywhere else Nav handles it.
   * @returns {boolean} whether the key was consumed
   */
  handleKey(e){
    if(engine.state!=="playing"||!engine.paused)return false;
    if((e.code==="Enter"||e.code==="NumpadEnter")&&this.view==="confirm"){
      AUDIO&&AUDIO.play("ui_click",{ui:true});
      this.show("main");
      engine.quitToMenu();
      return true;
    }
    return Nav.handleKey(e);
  }
};
