// Nav-graph ownership and bot roster management.
import {CFG,SETTINGS,DIFFS,BOT_NAMES,TEAM_HEX} from '../core/config.js';
import {U,_va,_vb,_vc,_vd} from '../core/util.js';
import {PHYS,MATCH,WORLD,engine} from '../core/globals.js';
import {Bot} from './bot.js';

export class BotManager{
constructor(){}
buildNav(){
const defs=WORLD.navDefs;
const nodes=defs.map(d=>({p:d.p,flags:d.flags,links:[]}));
for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
const a=nodes[i],b=nodes[j];
const d=a.p.distanceTo(b.p);
if(d>11.5)continue;
_va.copy(a.p);_va.y+=1.1;_vb.copy(b.p);_vb.y+=1.1;
if(PHYS.losClear(_va,_vb,null)||d<4.5){
const c=d;
a.links.push({j,c});b.links.push({j:i,c});
}
}
for(const[i,j]of WORLD.navLinks){
nodes[i].links.push({j,c:1.2});nodes[j].links.push({j:i,c:1.2});
}
this.nodes=nodes;
}
nearestNode(pos){
if(!pos)return null;
let best=null,bd=1e9;
for(const n of this.nodes){const d=n.p.distanceToSquared(pos);if(d<bd){bd=d;best=n}}
return best;
}
randomNode(hot){
const pool=this.nodes.filter(n=>!n.flags.jump);
if(hot){const h=pool.filter(n=>n.flags.hot);if(h.length&&Math.random()<.7)return U.pick(h)}
return U.pick(pool.length?pool:this.nodes)}
nodeOf(flag){return this.nodes.some(n=>n.flags[flag])}
nearestFlagged(pos,flag){
if(!pos)return null;
let best=null,bd=1e9;
for(const n of this.nodes){if(!n.flags[flag])continue;const d=n.p.distanceToSquared(pos);if(d<bd){bd=d;best=n}}
return best;
}
coverAway(pos,threat){
let best=null,bd=-1;
for(const n of this.nodes){
const d1=n.p.distanceTo(pos);
if(d1>26||d1<4)continue;
const d2=threat?n.p.distanceTo(threat):20;
const sc=Math.min(d2,30)-d1*.4;
if(sc>bd){bd=sc;best=n}
}
return best||this.randomNode();
}
findPath(from,to){
if(!from||!to)return to?to.clone():from?from.clone():null;
const a=this.nearestNode(from),b=this.nearestNode(to);
if(!a||!b)return[to.clone()];
if(a===b)return[b.p.clone()];
const open=[{n:a,g:0,f:a.p.distanceTo(b.p),parent:null}];
const closed=new Set();
let guard=0;
while(open.length&&guard++<5000){
open.sort((x,y)=>x.f-y.f);
const cur=open.shift();
if(cur.n===b){
const out=[];let q=cur;
while(q){out.unshift(q.n.p.clone());q=q.parent}
return out;
}
closed.add(cur.n);
for(const l of cur.n.links){
const nb=this.nodes[l.j];
if(closed.has(nb))continue;
const g=cur.g+l.c;
const ex=open.find(o=>o.n===nb);
if(ex&&ex.g<=g)continue;
open.push({n:nb,g,f:g+nb.p.distanceTo(b.p),parent:cur});
}
}
return[b.p.clone()];
}
/**
 * @param {Object<number,number>} comp team id -> bot count.
 * The count is authoritative: the lobby decides it, nothing is inferred from
 * team size any more. That is what stopped 1v1-with-a-friend from also
 * spawning a bot on the enemy team.
 */
spawnBots(comp){
const names=BOT_NAMES.slice().sort(()=>Math.random()-.5);
let n=0;
for(const teamStr of Object.keys(comp)){
const team=+teamStr;
const want=Math.max(0,comp[teamStr]|0);
for(let i=0;i<want;i++){
const bot=new Bot(names[n%names.length],SETTINGS.diff,team,TEAM_HEX[team]||0xcccccc);
n++;
engine.add(bot);
engine.combatants.push(bot);
MATCH.spawnEntity(bot);
}
}
}
}