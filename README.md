# NEON VORTEX — Browser FPS Battle Arena

A fully self-contained, single-file 3D FPS built with Three.js + Cannon.js + Web Audio.
No build step, no external assets (except one GLB map) — open `neon-vortex.html` and play.

## ▶ Play

**Option A — local file:** double-click `neon-vortex.html` (Chrome/Edge/Firefox/Safari).

**Option B — local server (recommended, enables the GLB map on strict browsers):**
```bash
python3 -m http.server 8080
# open http://localhost:8080/neon-vortex.html
```

**Option C — online:** GitHub Pages serves this repo — see *Hosting* below.

## Game Modes
- **Free-For-All** — 8 players, first to 15
- **Team Deathmatch** — 5v5, first to 30
- **Control Point** — 5v5 king-of-the-hill, first to 150
- **Bomb Defusal (new)** — CS-style rounds on the Dust II GLB map:
  - Terrorists plant at site **A** or **B** (hold **E** inside the site, 3.2s), 40s fuse
  - Counter-Terrorists defuse (hold **E** near the bomb, 5s)
  - No respawns during a round; elimination / time / explosion / defuse decides it
  - First to **8 rounds** wins. Lobby size configurable: **1v1 → 5v5** (bots fill)
  - Pick your side (CT / T) in the menu

## Arenas
- **Neon Cyber-Grid** — indoor multi-tier, jump pads, energy walkways
- **Rust & Lava Foundry** — open industrial, lava hazard (15 HP/s), sniper towers
- **Orbital Sanctum** — low gravity (g = −4.9), teleporters, kinetic shields
- **Dust II · PVP Map** — your `pvp_map.glb` layout with auto-generated navigation,
  procedural textures, bomb sites A/B placed on the classic layout

## Arsenal (1–5 / mouse wheel)
1. **Cyber Assault Rifle** — hitscan auto, spread bloom, tracers, shell ejection
2. **Graviton Shotgun** — 12 pellets, heavy knockback
3. **Plasma Cannon** — arcing projectiles, 4.5m AoE + knockback (rocket-jump friendly)
4. **Thermal Railgun** — hold to charge, pierces multiple targets, scope on ADS
5. **Vortex Launcher** — sticky bombs, 3 shock pulses, then detonation

Choose your deploy loadout + starting weapon in the menu.

## Movement
WASD · Space (double-jump) · Shift sprint · C slide/crouch · bunny-hop friendly
(auto-bhop toggle in settings)

## Settings (all persisted)
Sensitivity + ADS sensitivity · FOV · screen shake / head bob / bloom sliders ·
crosshair color & size · viewmodel left/right hand + offset · auto-reload ·
damage numbers · film grain · chromatic aberration · radar rotation · friendly fire.

## Bot Skill
Novice → Nightmare (reaction time, aim error, burst discipline, tracking speed).

## Tech
- Three.js r128 + EffectComposer (bloom, chromatic aberration, vignette, grade, grain)
- Cannon.js physics (kinematic FPS controller, trimesh GLB collision)
- 100% procedural Web Audio synthesis (no audio files) — positional, per-arena ambience
- GPU particle system, pooled lights, floating damage text, kill feed, radar, scoreboard
- Utility-FSM bots with A* waypoint navigation (auto-generated on the GLB map)
- Socket.io-compatible network layer with automatic offline fallback

## Playing with a friend (free, no server needed)

Built-in **P2P multiplayer** via WebRTC (PeerJS): the game is hosted right here on
GitHub Pages, and match traffic flows directly between the two browsers.

1. Both players open: **https://niklasniemi.github.io/neon-vortex-fps/neon-vortex.html**
2. Host: click **HOST GAME** → a 4-digit code appears → pick mode/map/side → **DEPLOY**
3. Friend: type the code → **JOIN** → they auto-deploy onto the host's match
   (opposite side; bots fill remaining slots — 1v1 up to 5v5)

The host's browser runs the authoritative simulation; the guest's inputs are relayed
and the world streams back — direct P2P, so lag equals the distance between you.
Bomb Defusal works fully in P2P (plant/defuse/rounds).

### If the public PeerJS broker is congested
Run your own free signaling relay (only used for handshakes — game traffic stays P2P):

```bash
npx peerjs --port 9000 --path /myapp          # on any always-on machine (or free tier VM)
# then both players open:
# .../neon-vortex.html?peer=YOUR_SERVER_IP:9000:/myapp
```

### Other free options
- **Client hosting alternatives:** Cloudflare Pages / Netlify / itch.io (upload as HTML)
- **Dedicated WebSocket server later:** Fly.io / Render free tier / Oracle Always-Free VPS —
  the engine's Socket.io-compatible layer is ready for an authoritative server upgrade

## Tech

---
*Built as a single-file engine: data-driven registries for weapons / arenas / modes /
particles / sounds — new content is a config object, not a refactor.*
