// Map registry. One map: Dust II.
// Lighting is tuned for a hot, low-contrast desert afternoon -- strong warm
// key light, bright sand bounce from below, and a haze that fades long sightlines
// rather than the neon fog the arcade build used.
import {CFG} from '../core/config.js';

export const ARENAS={
  dust2:{
    id:"dust2",label:"DUST II",desc:"BOMB DEFUSAL · BOMBSITES A & B",
    glb:"pvp_map.glb",
    grav:-15.5,jumpVel:CFG.jump,charGravScale:CFG.charGravScale,airAccel:CFG.accelA,

    // Desert afternoon
    fog:{c:0xd9c49b,n:55,f:260},
    bg:0xbfa87e,
    skyTop:0x5d8fc4,      // zenith blue for the sky dome
    hemi:{s:0xffeccb,g:0x8a6b42,i:.52},   // sky warm, ground bounce sandy
    ambLight:.08,
    sun:{p:[38,52,22],i:2.25,c:0xfff2d8},
    grade:{tint:[1.07,1.02,.92],amt:.22},
    bloom:{s:.32,r:.35,t:.90},            // subtle -- realistic, not neon
    amb:"desert",surf:"concrete",
    kinematic:true,

    // Hand-tuned, playtest-verified coordinates.
    sites:[{name:"A",x:-18.7,z:-15.3,r:5},{name:"B",x:-20.5,z:18.9,r:5}],
    spCT:[[-17.5,-6.1],[-15.4,-7.4],[-19.4,-4.9],[-16.1,-4.1],[-19.1,-8.2]],
    spT:[[23.5,7.1],[25.2,5.0],[21.7,9.0],[24.8,9.4],[22.3,4.8]],
    ctYaw:-90,tYaw:90,
    mid:[1,-.5]
  }
};

export const DEFAULT_MAP="dust2";
