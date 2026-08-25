// Lobby composition rules -- run in the browser console:
//   import('/tests/lobby.test.js').then(m=>console.table(m.run()))
import {NET2} from '/src/net/p2p.js';

const out=[];
const check=(name,pass,detail)=>out.push({test:name,result:pass?"PASS":"FAIL",detail});

function scenario(fn){
  const saved=JSON.parse(JSON.stringify(NET2.lobby));
  const savedConn=NET2.connected, savedHost=NET2.isHost;
  try{ fn() } finally {
    NET2.lobby=saved; NET2.connected=savedConn; NET2.isHost=savedHost;
  }
}

export function run(){
  out.length=0;

  // --- solo 1v1: you + one enemy bot, nobody on your side ------------------
  scenario(()=>{
    NET2.isHost=true; NET2.connected=false;
    NET2.lobby.hostTeam=1;
    NET2.lobby.bots={1:0,2:1};
    const c=NET2.composition();
    check("solo 1v1: exactly one enemy bot", c[1]===0&&c[2]===1, JSON.stringify(c));
    check("solo 1v1: teams are 1 v 1",
      NET2.teamCount(1)===1&&NET2.teamCount(2)===1,
      `CT ${NET2.teamCount(1)} v T ${NET2.teamCount(2)}`);
  });

  // --- 1v1 WITH A FRIEND: this is the bug that was reported ----------------
  scenario(()=>{
    NET2.isHost=true; NET2.connected=true;      // friend attached
    NET2.lobby.hostTeam=1;
    NET2.lobby.bots={1:0,2:0};
    const c=NET2.composition();
    check("1v1 + friend: NO bots are spawned", c[1]===0&&c[2]===0, JSON.stringify(c));
    check("1v1 + friend: your friend is the only opponent",
      NET2.teamCount(1)===1&&NET2.teamCount(2)===1,
      `CT ${NET2.teamCount(1)} (you) v T ${NET2.teamCount(2)} (friend)`);
    check("1v1 + friend: friend counted on the opposite side",
      NET2.humansOn(2)===1&&NET2.humansOn(1)===1,
      `humans CT=${NET2.humansOn(1)} T=${NET2.humansOn(2)}`);
  });

  // --- bot counts clamp against the humans already on the team ------------
  scenario(()=>{
    NET2.isHost=true; NET2.connected=true;
    NET2.lobby.hostTeam=1;
    NET2.setBots(1,9);
    check("bots clamp to 5 per team including humans",
      NET2.teamCount(1)===5, `CT total ${NET2.teamCount(1)} (bots ${NET2.lobby.bots[1]})`);
    NET2.setBots(2,9);
    check("guest's team also leaves room for the guest",
      NET2.teamCount(2)===5&&NET2.lobby.bots[2]===4,
      `T total ${NET2.teamCount(2)} (bots ${NET2.lobby.bots[2]} + 1 human)`);
  });

  // --- negative counts are rejected ---------------------------------------
  scenario(()=>{
    NET2.isHost=true; NET2.connected=false;
    NET2.setBots(2,-3);
    check("bot count never goes negative", NET2.lobby.bots[2]===0, `${NET2.lobby.bots[2]}`);
  });

  // --- swapping sides re-clamps both teams --------------------------------
  scenario(()=>{
    NET2.isHost=true; NET2.connected=true;
    NET2.lobby.hostTeam=1;
    NET2.setBots(1,4); NET2.setBots(2,4);
    NET2.setHostTeam(2);
    check("swapping sides keeps both teams at five or fewer",
      NET2.teamCount(1)<=5&&NET2.teamCount(2)<=5,
      `CT ${NET2.teamCount(1)} v T ${NET2.teamCount(2)}`);
  });

  // --- a guest cannot edit the host's lobby -------------------------------
  scenario(()=>{
    NET2.isHost=false; NET2.connected=true;
    NET2.lobby.bots={1:2,2:2};
    NET2.setBots(1,5);
    check("guest cannot change bot counts", NET2.lobby.bots[1]===2, `${NET2.lobby.bots[1]}`);
  });

  return out;
}
