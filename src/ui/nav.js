// Keyboard navigation for every menu surface.
//
// Arrows move a focus ring between the interactive controls of whichever panel
// is on screen, Enter or Space activates, Escape steps back. Rows of segmented
// buttons and slider handles behave the way you would expect: left/right walks
// along the row or nudges the value, up/down leaves it.
const FOCUSABLE='button:not([disabled]),input[type=text],input[type=range],input[type=color]';

export const Nav={
  root:null,          // element whose controls are currently navigable
  items:[],
  idx:-1,
  onBack:null,        // called for Escape / Backspace
  enabled:false,

  /**
   * Points navigation at a container.
   * @param {HTMLElement} root panel to navigate
   * @param {Function} onBack handler for Escape
   */
  attach(root,onBack){
    this.root=root;
    this.onBack=onBack||null;
    this.enabled=!!root;
    this.refresh();
    // Start with nothing highlighted; the first arrow press selects.
    this.idx=-1;
    this.paint();
  },

  detach(){
    this.clearFocus();
    this.root=null;this.items=[];this.idx=-1;this.enabled=false;this.onBack=null;
  },

  /** Re-reads the control list -- call after showing or hiding anything. */
  refresh(){
    if(!this.root){this.items=[];return}
    const cur=this.items[this.idx];
    this.items=Array.from(this.root.querySelectorAll(FOCUSABLE)).filter(el=>{
      if(el.disabled)return false;
      if(el.closest('.hidden'))return false;
      // offsetParent is null for anything not laid out (display:none ancestors)
      return el.offsetParent!==null;
    });
    const again=this.items.indexOf(cur);
    if(again>=0)this.idx=again;
    else if(this.idx>=this.items.length)this.idx=this.items.length-1;
  },

  clearFocus(){
    for(const el of this.items)el.classList.remove('navfocus');
  },

  paint(){
    this.clearFocus();
    const el=this.items[this.idx];
    if(!el)return;
    el.classList.add('navfocus');
    if(el.scrollIntoView)el.scrollIntoView({block:'nearest'});
  },

  move(d){
    this.refresh();
    if(!this.items.length)return;
    this.idx=this.idx<0 ? (d>0?0:this.items.length-1)
                        : (this.idx+d+this.items.length)%this.items.length;
    this.paint();
  },

  /** Left/right: walk a segmented row, or nudge a slider. */
  lateral(d){
    this.refresh();
    const el=this.items[this.idx];
    if(!el){this.move(d);return}
    if(el.type==='range'){
      const step=(+el.step||1)*(d>0?1:-1);
      el.value=Math.max(+el.min,Math.min(+el.max,(+el.value)+step*4));
      el.dispatchEvent(new Event('input',{bubbles:true}));
      return;
    }
    const row=el.closest('.seg,.tglrow,.confirmrow,.stabs,.botrow');
    if(row){
      const sibs=Array.from(row.querySelectorAll(FOCUSABLE)).filter(x=>!x.disabled);
      const i=sibs.indexOf(el);
      if(i>=0&&sibs.length>1){
        const next=sibs[(i+d+sibs.length)%sibs.length];
        this.idx=this.items.indexOf(next);
        this.paint();
        return;
      }
    }
    this.move(d);
  },

  activate(){
    const el=this.items[this.idx];
    if(!el)return false;
    if(el.tagName==='INPUT'&&el.type==='text'){el.focus();return true}
    if(el.type==='range')return true;         // arrows already adjust it
    el.click();
    // The panel usually changed; rebuild and keep a sane highlight.
    setTimeout(()=>{this.refresh();if(this.idx>=this.items.length)this.idx=0;this.paint()},0);
    return true;
  },

  /** @returns {boolean} whether the key was consumed */
  handleKey(e){
    if(!this.enabled||!this.root)return false;
    // Let people type into text fields without hijacking the keys.
    const t=document.activeElement;
    if(t&&t.tagName==='INPUT'&&t.type==='text'&&e.code!=='Escape'&&e.code!=='Enter')return false;

    switch(e.code){
      case'ArrowDown': this.move(1);return true;
      case'ArrowUp':   this.move(-1);return true;
      case'ArrowRight':this.lateral(1);return true;
      case'ArrowLeft': this.lateral(-1);return true;
      case'Enter':
      case'NumpadEnter':
      case'Space':
        if(t&&t.tagName==='INPUT'&&t.type==='text'){t.blur();return true}
        return this.activate();
      case'Escape':
      case'Backspace':
        if(this.onBack){this.onBack();return true}
        return false;
    }
    return false;
  }
};
