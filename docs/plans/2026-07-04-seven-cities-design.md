# Seven Cities of Gold — Modern Clone: Design

**Date:** 2026-07-04
**Status:** Approved

## Vision

A modern, browser-based clone of *The Seven Cities of Gold* (Ozark Softscape / EA, 1984).
The player is a conquistador who makes landfall in a procedurally-generated New World and
explores a real-time, scrolling, fog-of-war map on foot — hunting native villages to trade
with, gift, or raid for gold, while managing a dwindling supply of food, crew, and morale.
The goal is to discover the seven fabled Cities of Gold before the expedition collapses.

## Scope (MVP core loop)

Deliver the essential magic as a complete, playable game:
- Procedural New World map, seeded/reproducible.
- Make landfall from a ship just offshore.
- Real-time continuous movement across a smooth-scrolling tile map.
- Fog-of-war reveal that persists (charted map).
- Villages with trade / gift / attack encounters.
- Resource management: food, crew, gold, morale, day.
- Win by finding all 7 Cities of Gold; lose on crew/morale/food failure.

**Out of scope for MVP:** outfitting expeditions in Spain, Crown funding/ranks, multiple
voyages, ocean sailing gameplay, ships economy. (Candidate for a later phase.)

## Tech stack

Vanilla **TypeScript + Vite + HTML5 Canvas 2D**. Hand-rolled `requestAnimationFrame`
game loop. No game framework — leanest path to the real-time feel, full control over loop
and camera. Pixel-art tiles generated procedurally to offscreen canvases. **Vitest** for
unit tests. Chosen over Phaser/kaplay (heavier, opinionated) and React (fights a 60fps loop).

## Architecture

```
seven-cities/
  index.html
  src/
    main.ts            # bootstrap, canvas setup, game loop
    engine/
      loop.ts          # fixed-timestep update + render
      input.ts         # keyboard state (WASD/arrows, action keys)
      camera.ts        # follows explorer, world<->screen conversion
      renderer.ts      # draws visible tiles + sprites + fog
    world/
      mapgen.ts        # procedural New World generation (seeded)
      tiles.ts         # tile types, colors, walkability/speed
      fog.ts           # fog-of-war reveal state
    game/
      state.ts         # central game state
      explorer.ts      # movement, terrain speed, food consumption
      villages.ts      # village placement + hidden profiles
      encounter.ts     # resolves trade/gift/attack, updates state
    ui/
      hud.ts           # food/crew/gold/morale/day/cities readout
      panels.ts        # encounter dialog, start/game-over/win screens
    art/
      tileset.ts       # procedural pixel tiles -> offscreen canvas
      sprites.ts       # explorer + village sprites
  tests/               # vitest unit tests
```

**Key principle:** pure logic (`world/`, `game/`) is fully decoupled from rendering
(`engine/renderer`, `ui/`) so map generation, fog reveal, and encounter resolution are
unit-testable without a canvas.

## World generation

Seeded procedural generator (reproducible + testable). Finite tile grid, **256×256**,
from value-noise/fractal elevation + moisture:

- **Elevation** → ocean / beach / lowland / highland / mountain (peaks impassable).
- **Moisture** → grassland / forest / jungle / desert on land.
- **Rivers** traced downhill to the sea (cosmetic + slow to cross).
- West edge is deep ocean; player starts on a ship just offshore and makes landfall.

**Tiles** carry (1) walkability/speed cost (ocean blocks on-foot; forest slower than grass;
mountain peaks impassable) and (2) color/pattern for the renderer.

**Villages:** ~15–25 native settlements on habitable land, each with a hidden profile —
wealth level, temperament (friendly↔hostile), population. Spaced apart and away from the
coast so exploration is required. **7 of the high-wealth villages are the golden Cities.**

**Fog of war:** all tiles start unseen; a radius around the explorer reveals as you move
and stays revealed (dimmed) once seen. Revealing tiles is the core reward loop and feeds score.

## Gameplay loop & resources

Land → drive explorer across fog-of-war map → find villages → manage food → decide how to
handle each settlement.

| Resource | Start | Changes when |
|----------|-------|--------------|
| Food     | 500   | Ticks down over time (crew eats). Zero → starvation, morale craters. |
| Crew     | 100   | Lost to starvation / failed attacks. Zero → game over. |
| Gold     | 0     | Gained from trade / gift-driven finds / raids. Score. |
| Morale   | 100   | Falls with starvation & reckless losses; rises with peaceful contact. Zero → mutiny → game over. |
| Day      | 1     | Advances with time; used for scoring. |

**Encounters** (village panel, three choices):
- **Trade** — goods for gold & food; rate scales with temperament.
- **Gift** — spend goodwill to raise friendliness & morale; can reveal nearby villages.
- **Attack** — risk crew to seize all gold; hostile/large villages fight back hard.

Each village depletes after a meaningful interaction — the map is a finite treasure field.

**Win:** reach/claim all **7 Cities of Gold**.
**Lose:** crew 0, or morale 0 (mutiny), or unrecoverable starvation.
**Score:** gold + tiles charted + villages contacted − days taken.

## Controls & UI

- **WASD / Arrows** — move (real-time, continuous).
- **E / Space** — interact when adjacent to a village.
- **1 / 2 / 3** — Trade / Gift / Attack.
- **Esc** — close panel / pause.

**HUD:** top bar with Food, Crew, Gold, Morale, Day, "Cities: X/7". Encounter panel is a
centered overlay. Start screen (seed + "Set sail"), game-over and victory screens with final
score. Corner minimap of charted territory is a nice-to-have.

## Error handling

- Movement clamped to bounds; can't enter ocean/impassable tiles.
- Encounter panel blocks movement input (no double-resolve).
- Invalid/blank seed → default seed.
- State transitions guarded (no acting after game-over).

## Testing (vitest)

Pure-logic unit tests:
- **mapgen:** same seed → identical map; produces land + ocean; villages on walkable land,
  spaced apart; exactly 7 golden cities.
- **fog:** reveal radius correct; seen tiles stay seen.
- **encounter:** trade/gift/attack move state correctly; attack can fail; values stay in bounds.
- **state:** food drains; zero crew/morale → game-over; 7 cities → win.

Rendering and input verified manually in the browser.
