# DUST II — Browser Tactical FPS

A 5v5 bomb-defusal shooter that runs entirely in the browser. Three.js + Cannon.js +
Web Audio + PeerJS, no build step, no bundler, no server-side code.

## Play

ES modules require an HTTP origin, so `file://` will not work. Serve the folder:

```bash
python3 devserver.py 8123
```

Then open <http://localhost:8123>. Any static server works; `devserver.py` just adds
no-cache headers so edits show up on reload.

## Controls

| | |
|---|---|
| `WASD` | Move |
| `Space` | Jump |
| `Shift` | Walk (silent) |
| `Ctrl` / `C` | Crouch |
| `LMB` / `RMB` | Fire / aim |
| `R` | Reload |
| `1` `2` `3` | Primary · pistol · knife |
| `G` | Cycle grenades |
| `B` | Buy menu |
| `E` (hold) | Plant / defuse |
| `Tab` | Scoreboard |
| `Esc` | Pause / step back one level |

Menus take the arrow keys, with Enter or Space to activate and Escape to go back.
Escape never quits a match on its own -- abandoning always goes through a
confirmation. Optional rules live under Settings → Rules.

## What's in it

**One map, one mode.** Dust II, bomb defusal, MR15. The arcade arenas, jump pads,
teleporters, lava and floating pickups are gone.

**Radar.** A floor plan rasterised from the collision field at load time, with walls,
elevation shading and bombsite labels. It rotates with you. Enemies are not simply
drawn wherever they are -- they appear only when your team has line of sight, or
briefly after they fire (less briefly if the weapon is suppressed). A contact that
breaks line of sight fades to a hollow "last known" marker before dropping off.

**Spectating.** Killed with team-mates still alive, you follow them in third person
and cycle with A/D, the arrow keys, Space or the scroll wheel. (With the takeover
rule on you drop into a survivor instead -- see Optional rules.)

**Audio.** Fully synthesised: a procedural convolution reverb, HRTF panning,
distance-based air absorption, pink and brown noise, and per-shot pitch and timbre
jitter so repeated gunfire never loops. Each weapon is layered from a transient
crack, a muzzle-blast body and a room tail. There is a procedural score for the
menu and a tension cue while the bomb is ticking.

**Performance.** Raycasts go through a uniform-grid broadphase rather than testing
every collider, and the renderer walks a quality ladder (resolution, shadow map,
bloom) to hold 60 fps. Settings -> Video lets you lock a tier; the FPS chip shows
which one is active.

**Counter-Strike weapon model.** AK-47, M4A1-S, AWP, MP9, Nova, Desert Eagle,
Glock-18, USP-S and a knife, with CS damage, armour penetration and fire rates
(scaled to this build's slower tempo). Rifles have learnable spray patterns.
Armour scales incoming damage and degrades rather than acting as a second health bar.

**Economy.** Kill rewards by weapon, 3250 for a round win, an escalating loss bonus,
and gear lost on death.

**Buy window.** 15s freeze, 20s buy timer, and after that you can still buy from your
own spawn *provided you have not moved yet* — stepping out latches the shop shut.

**Bots with orders.** Per-round objectives over an auto-generated nav graph: Ts escort
the carrier and plant, flankers rotate, CTs split the sites with a mid roamer.

**Optional rules** (Settings → Rules).
*Take over a team-mate on death* — when you are killed with team-mates still
alive, you drop into a random survivor for the rest of the round instead of
spectating. It is not a free respawn: you inherit that operator's position,
health, armour, weapon, magazine, grenades and money, and they leave the board,
so your side is exactly as strong as your death left it.
*Unlimited ammo / grenades / money* — practice toggles. Local only: a P2P guest
is simulated by the host, so they cannot take effect there, and they never apply
to bots. A HUD badge shows which are active.

**Friend play.** PeerJS WebRTC, host-authoritative, 4-digit room codes, zero server cost.
The lobby lets you add and remove bots per team, and bot counts are explicit — a 1v1
with a friend spawns no bots at all.

## Layout

```
index.html            markup + CDN script tags
src/style.css         all styling
src/main.js           boot: constructs systems, starts the loop
src/core/             config, globals registry, util, input, audio
src/render/           textures, materials, particles, view models, pipeline
src/world/            arena builder, GLB loader, collision, navmesh, props, map defs
src/entities/         combatant, movement, player, bot, bot manager, projectiles
src/game/             weapons, weapon system, physics, modes, match, economy, engine
src/net/              PeerJS transport and networked entities
tests/                browser test suites
```

`src/core/globals.js` holds the live-binding service registry. The original build kept
every system in one closure with mutable slots; ES module live bindings reproduce that
exactly, so modules can reference each other without circular-import problems.

## Tests

165 checks across twelve suites, run from the browser console after starting a match:

```js
import('/tests/all.js').then(m => m.run()).then(console.log)
```

Each suite gets a fresh match, because the suites drive live entities and sharing one
match makes results depend on ordering. Individual suites:

```js
import('/tests/physics.test.js').then(m => console.table(m.run()))
```

A full pass rebuilds the map once per suite, which can outrun a single console
call. Run it in halves if needed:

```js
import('/tests/all.js').then(m => m.run(["physics","slope","walls","lobby","gameplay","audio"]))
import('/tests/all.js').then(m => m.run(["firing","bots","rounds","roundflow","rules","radar"]))
```

There is also a profiler for frame cost:

```js
import('/tests/perf.test.js').then(m => console.log(m.run()))
```

| Suite | Covers |
|---|---|
| `physics` | jump arc, wall sweeps, ceiling clamp, crouch |
| `slope` | vertical jerk walking up and down the map's hill |
| `walls` | thousands of bot-frames with no clipping or falling out of the world |
| `lobby` | bot composition, team clamping, host/guest permissions |
| `gameplay` | buy window rules, purchases, regeneration, armour maths |
| `firing` | every weapon lands damage, ammo, movement penalty |
| `bots` | nav graph, pathing, target acquisition, engagement, aim |
| `rounds` | round setup, roles, pistol economy, plant zones, payouts |
| `rules` | team-mate takeover, and each practice toggle on and off |
| `roundflow` | rounds two onward start with a full clock and do not end early |
| `radar` | rotation geometry, and what the radar is allowed to reveal |
| `audio` | every sound the game plays exists and is well formed |

## Notes

- The map GLB (~14 MB) is committed directly. If it starts changing often, move it to
  Git LFS before the repo history gets heavy.
- Rendering pauses when the tab is hidden — that is `requestAnimationFrame`, not a bug.
