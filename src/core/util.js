// Small math/format helpers plus the shared scratch vectors.
// THREE is loaded as a global from the CDN script tags in index.html.
export const U={
  clamp:(v,a,b)=>v<a?a:v>b?b:v,
  lerp:(a,b,t)=>a+(b-a)*t,
  damp:(a,b,l,dt)=>U.lerp(a,b,1-Math.exp(-l*dt)),
  rand:(a,b)=>a+Math.random()*(b-a),
  randi:(a,b)=>Math.floor(U.rand(a,b+1)),
  pick:a=>a[Math.floor(Math.random()*a.length)],
  gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*v)},
  fmt:s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+":"+("0"+s%60).slice(-2)},
  angLerp(a,b,t){let d=(b-a)%6.283185307;if(d>3.14159)d-=6.283185;if(d<-3.14159)d+=6.283185;return a+d*t},
  noise1(x){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);const h=n=>{const s=Math.sin(n*127.1)*43758.545;return s-Math.floor(s)};return U.lerp(h(i),h(i+1),u)*2-1},
  // Deterministic PRNG -- prop dressing must land identically for every client.
  mulberry(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
};

export const _va=new THREE.Vector3(),_vb=new THREE.Vector3(),_vc=new THREE.Vector3();
export const _vd=new THREE.Vector3(),_ve=new THREE.Vector3(),_vf=new THREE.Vector3();
export const _q1=new THREE.Quaternion(),_eu=new THREE.Euler(0,0,0,"YXZ");
