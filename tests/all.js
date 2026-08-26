// Runs every suite and prints one summary.
//   import('/tests/all.js').then(m=>m.run()).then(r=>console.log(r))
//
// Each suite gets a FRESH match. The suites drive live entities -- teleporting
// bots, running the player into walls, forcing round phases -- so sharing one
// match between them makes results depend on execution order rather than on
// the code under test.
const SUITES=["physics","slope","walls","lobby","gameplay","firing","bots","rounds","rules"];

function freshMatch(){
  const e=window.engine;
  const N=window.NV.NET2;
  // Reproduce what the DEPLOY button sets up: a full 5v5 against bots. Calling
  // engine.deploy() straight would inherit whatever lobby state was left over
  // and give the suites a 1v1 to work with.
  N.isHost=false;N.connected=false;N._pendingGuest=false;
  N.lobby.hostTeam=1;
  N.lobby.bots={1:4,2:5};
  N.lobby.started=true;
  return new Promise((resolve,reject)=>{
    // deploy() is a no-op while a match is running (it guards against a
    // double-click on DEPLOY). Without quitting first, every suite silently
    // shared ONE match -- which is what made the bot checks look flaky.
    if(e.state==="playing")e.quitToMenu();
    e.deploy("dust2","defuse");
    let waited=0;
    const id=setInterval(()=>{
      waited+=100;
      const M=window.NV.MATCH;
      // Wait for the ROUND to be set up, not just for the match to exist.
      // startMatch resolves the map asynchronously and assigns the bomb carrier
      // and per-round roles at the end; handing a suite a half-initialised
      // match is what made the bot checks look flaky.
      const ready=e.state==="playing"
        && window.NV.WORLD && window.NV.WORLD.spans
        && M && M.mode && M.mode.roundBased
        && !!M.carrier
        && e.combatants.filter(c=>c.isBot).length>0;
      if(ready){
        clearInterval(id);
        setTimeout(resolve,80);
      }else if(waited>25000){
        clearInterval(id);
        reject(new Error("match never finished starting (state="+e.state+
          ", carrier="+(M&&M.carrier?"yes":"no")+")"));
      }
    },100);
  });
}

/**
 * @param {string[]} [only] subset of suite names; omit to run everything.
 * A full pass rebuilds the map once per suite, which can exceed a single
 * console call's time budget -- run halves if you hit that.
 */
export async function run(only){
  const list=(only&&only.length)?SUITES.filter(s=>only.includes(s)):SUITES;
  const all=[];
  for(const s of list){
    await freshMatch();
    const m=await import(`/tests/${s}.test.js?t=${Date.now()}`);
    const fn=m.runChecks||m.run;
    for(const r of fn())all.push({suite:s,...r});
  }
  const fails=all.filter(r=>r.result==="FAIL");
  return {
    total:all.length,
    passed:all.length-fails.length,
    failed:fails.length,
    failures:fails.map(f=>`[${f.suite}] ${f.test} :: ${f.detail}`),
    bySuite:list.map(s=>{
      const rs=all.filter(r=>r.suite===s);
      return `${s}: ${rs.filter(r=>r.result==="PASS").length}/${rs.length}`;
    })
  };
}
