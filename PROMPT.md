# DUST II — Design Brief

A browser-native 5v5 tactical FPS whose gameplay, pacing and map identity follow
Counter-Strike: Dust II, while staying 100% client-side (Three.js + Cannon.js +
Web Audio + PeerJS), dependency-light and deployable to any static host.

## Pillars

1. **One map, one mode.** Dust II, bomb defusal. Bombsites A and B and both spawns sit
   at hand-tuned, playtest-verified coordinates. No arcade arenas, jump pads,
   teleporters, lava or floating pickups.

2. **CS movement grammar.** Single run speed, shift-walk, crouch, one floaty low jump,
   no sprint and no double jump. Jump apex ~0.66 m over ~1 s of airtime.

3. **Solid world.** Collision is a multi-layer *span field*: each grid cell stores the
   stack of free vertical intervals between floors and ceilings. That makes walls solid,
   ceilings real, and multi-storey geometry walkable. A single-height field cannot do
   this — it was why players walked through walls and jumped through roofs.

4. **Realistic arsenal.** AK-47, M4A1-S, AWP, MP9, Nova, Desert Eagle, Glock-18, USP-S,
   knife. CS damage, headshot multipliers, armour penetration and fire rates. Rifles
   carry learnable spray patterns. Armour scales damage and degrades; it is not a second
   health bar. Health never regenerates; armour trickles back slowly.

5. **Full defusal loop.** 15 s freeze, 20 s buy timer, plus buying from your own spawn
   afterwards while you have not moved. Plant and defuse on hold-E, 40 s fuse, defuse
   kits, round and MVP flow, half-time swap.

6. **Utility.** HE, flashbang, smoke and molotov/incendiary with bounce physics, fuses
   and synthesized audio. Smoke blocks AI vision; flashes blind players and bots.

7. **Bots with orders.** A utility FSM over an auto-generated nav graph, with per-round
   objectives: Ts escort the carrier and plant, flankers rotate on a timer, CTs split
   the sites with a mid roamer, dropped bombs are retrieved by the nearest T. Humanised
   aim across four difficulty tiers.

8. **Free friend play.** PeerJS WebRTC, host-authoritative, 4-digit room codes. Bot
   counts are explicit lobby state, never derived from team size, so a 1v1 with a friend
   spawns no bots.

9. **Modular source.** ES modules under `src/`, one concern per file, so a bug can be
   found without reading the whole game.

## Quality bar

- 60 fps on integrated GPUs.
- No clipping through walls, floors or ceilings. No AI shooting through geometry.
- Every weapon must actually land damage — verified by an automated suite.
- Every system data-driven via registries, so content is configuration.
- Changes are covered by `tests/`, run in the browser against a live match.
