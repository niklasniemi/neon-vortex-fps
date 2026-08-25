// Runs every suite and prints one summary.
//   import('/tests/all.js').then(m=>m.run()).then(r=>console.log(r))
//
// Each suite gets a FRESH match. The suites drive live entities -- teleporting
// bots, running the player into walls, forcing round phases -- so sharing one
// match between them makes results depend on execution order rather than on
// the code under test.
const SUITES=["physics","lobby","gameplay","firing","bots","rounds"];

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
    e.deploy("dust2","defuse");
    let waited=0;
    const id=setInterval(()=>{
      waited+=100;
      if(e.state==="playing"&&window.NV.WORLD&&window.NV.WORLD.spans){
        clearInterval(id);
        // Let the round settle into its freeze phase before handing over.
        setTimeout(resolve,60);
      }else if(waited>20000){
        clearInterval(id);reject(new Error("match never started (state="+e.state+")"));
      }
    },100);
  });
}

export async function run(){
  const all=[];
  for(const s of SUITES){
    await freshMatch();
    const m=await import(`/tests/${s}.test.js?t=${Date.now()}`);
    for(const r of m.run())all.push({suite:s,...r});
  }
  const fails=all.filter(r=>r.result==="FAIL");
  return {
    total:all.length,
    passed:all.length-fails.length,
    failed:fails.length,
    failures:fails.map(f=>`[${f.suite}] ${f.test} :: ${f.detail}`),
    bySuite:SUITES.map(s=>{
      const rs=all.filter(r=>r.suite===s);
      return `${s}: ${rs.filter(r=>r.result==="PASS").length}/${rs.length}`;
    })
  };
}
