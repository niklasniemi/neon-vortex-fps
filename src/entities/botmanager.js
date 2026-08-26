// Nav-graph ownership and bot roster management.
import {CFG,SETTINGS,DIFFS,BOT_NAMES,TEAM_HEX} from '../core/config.js';
import {U,_va,_vb,_vc,_vd} from '../core/util.js';
import {PHYS,MATCH,WORLD,engine} from '../core/globals.js';
import {Bot} from './bot.js';

export class BotManager{
constructor(){}
/**
 * Builds the runtime navigation graph.
 *
 * This used to rebuild its own links from line of sight, with a blanket
 * `|| d < 4.5` that connected ANY two nodes within 4.5m whether or not a wall
 * stood between them. Bots then confidently pathed straight through walls and
 * jammed against them -- the single biggest reason CT bots, whose posts sit
 * among the bombsite architecture, could not move.
 *
 * Links now come from the navmesh, which tests real walkability, plus longer
 * hops that are themselves confirmed walkable.
 */
buildNav(){
const defs=WORLD.navDefs;
const nodes=defs.map(d=>({p:d.p,flags:d.flags,links:[]}));
const seen=new Set();
const connect=(i,j,cost)=>{
if(i===j)return;
const key=i<j?i+":"+j:j+":"+i;
if(seen.has(key))return;
seen.add(key);
nodes[i].links.push({j,c:cost});
nodes[j].links.push({j:i,c:cost});
};

// 1. Everything the navmesh already proved walkable.
for(const [i,j] of WORLD.navLinks)connect(i,j,nodes[i].p.distanceTo(nodes[j].p));

// 2. Longer hops, but only where a body could actually walk the line.
const SF=WORLD.spans;
if(SF){
for(let i=0;i<nodes.length;i++){
const a=nodes[i].p;
for(let j=i+1;j<nodes.length;j++){
const b=nodes[j].p;
const d=a.distanceTo(b);
if(d>11.5)continue;
const key=i+":"+j;
if(seen.has(key))continue;
if(SF.walkableBetween({x:a.x,y:a.y-.06,z:a.z},{x:b.x,y:b.y-.06,z:b.z},CFG.stepMax,CFG.standHeight))
connect(i,j,d);
}
}
}
this.nodes=nodes;
this.reportConnectivity();
}

/**
 * Measures how fragmented the graph is.
 * Reported against the LARGEST component, not an arbitrary starting node --
 * node 0 can sit in a two-node pocket and make a healthy graph look broken.
 */
reportConnectivity(){
const n=this.nodes.length;
if(!n){this.connectivity=0;this.components=[];return}
const comp=new Int32Array(n).fill(-1);
const sizes=[];
for(let i=0;i<n;i++){
if(comp[i]>=0)continue;
const id=sizes.length;let count=0;
const q=[i];comp[i]=id;
while(q.length){
const cur=this.nodes[q.pop()];
count++;
for(const l of cur.links)if(comp[l.j]<0){comp[l.j]=id;q.push(l.j)}
}
sizes.push(count);
}
sizes.sort((a,b)=>b-a);
this.components=sizes;
this.mainComponent=comp;
this.connectivity=sizes[0]/n;
if(this.connectivity<.85)
console.warn("[nav] largest island holds "+sizes[0]+"/"+n+
" nodes ("+sizes.length+" islands: "+sizes.slice(0,6).join(",")+")");
}
/**
 * Nearest node to `target` that is actually reachable from `from`.
 *
 * The graph legitimately contains islands -- rooftops and ledges you can only
 * reach by jumping. Handing a bot an objective stranded on one means it walks
 * at the nearest wall forever, so objectives are snapped onto the bot's own
 * component instead.
 *
 * @returns {{p:THREE.Vector3}|null}
 */
reachableNode(from,target){
if(!this.nodes.length)return null;
const comp=this.mainComponent;
const a=this.nearestNode(from);
if(!comp||!a)return this.nearestNode(target);
const myComp=comp[this.nodes.indexOf(a)];
let best=null,bd=1e9;
for(let i=0;i<this.nodes.length;i++){
if(comp[i]!==myComp)continue;
const d=this.nodes[i].p.distanceToSquared(target);
if(d<bd){bd=d;best=this.nodes[i]}
}
return best||this.nearestNode(target);
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
// Closest node reached, for the unreachable case handled below.
let best=open[0], bestH=a.p.distanceTo(b.p);
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
const h=cur.n.p.distanceTo(b.p);
if(h<bestH){bestH=h;best=cur}
for(const l of cur.n.links){
const nb=this.nodes[l.j];
if(closed.has(nb))continue;
const g=cur.g+l.c;
const ex=open.find(o=>o.n===nb);
if(ex&&ex.g<=g)continue;
open.push({n:nb,g,f:g+nb.p.distanceTo(b.p),parent:cur});
}
}
// Unreachable. Returning the destination would send the bot walking straight
// at whatever separates them; route to the closest point actually reached so
// it still makes progress and can search again from there.
if(best){
const out=[];let q=best;
while(q){out.unshift(q.n.p.clone());q=q.parent}
return out;
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