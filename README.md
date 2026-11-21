# Six Seven Cities of Gold Tone Metal

[![CI](https://github.com/TheScottyB/seven-cities/actions/workflows/ci.yml/badge.svg)](https://github.com/TheScottyB/seven-cities/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/TheScottyB/seven-cities/actions/workflows/pages.yml/badge.svg)](https://thescottyb.github.io/seven-cities/)
[![License: MIT](https://img.shields.io/badge/License-MIT-f4c430.svg)](LICENSE)
![Node 26 LTS](https://img.shields.io/badge/Node-26_LTS-339933)
![TypeScript 7](https://img.shields.io/badge/TypeScript-7-3178c6)
![Vite 8](https://img.shields.io/badge/Vite-8_Rolldown-646cff)
![pnpm 12](https://img.shields.io/badge/pnpm-12-f69220)
![Zero Runtime Deps](https://img.shields.io/badge/runtime_deps-0-7fd17f)

An unofficial, absurdly earnest fan tribute to *The Seven Cities of Gold* (1984), playable in the browser — six or seven fabled metropolises, certified genuine 14k gold-tone alloy.

**[Play Live on GitHub Pages →](https://thescottyb.github.io/seven-cities/)**

You are a conquistador making landfall in a procedurally generated New World. Chart the
coast and interior, parley with native villages (trade, amaze, offer gifts, or raid) while
your food, crew and morale run down. Find all seven fabled Cities of Gold-Tone Metal before
the expedition ceases to be, and sail home to Spain between voyages to bank your shiny alloy
and rise at court.

## Highlights

- **Zero runtime dependencies & zero asset files:** Every pixel-art sprite, terrain relief tile,
  deckle parchment edge, sound effect, ambient soundscape, and title-screen theme is synthesized
  at runtime in Canvas 2D and WebAudio (`~37 kB` gzipped bundle).
- **1984-faithful mechanics with dry humor:** Seeded continents, cordillera rivers (canoes),
  wind & roaming storms, village walk-ins, **Trade / Gift / Attack / Amaze** parley, 8-wind
  compass-bearing rumors, **Mission Forts** (provisions + pacification), **Make Camp** (`B`)
  morale recovery, and multi-voyage Spanish Court rank progression.
- **Bleeding-edge TypeScript 7 & supply-chain-hardened pnpm 12:** Strict TS 7 (`strict`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `satisfies`,
  ES Explicit Resource Management via `using` / `Symbol.dispose`), Node 26 LTS, Vite 8
  (Rolldown), Vitest 5 (320+ unit tests), and `pnpm-workspace.yaml` blocking unapproved build
  scripts, exotic subdeps, and provenance downgrades.
- **Strict pure/DOM architecture:** Worldgen, game rules, lore, save validation, audio
  direction, and lifecycle state machines never import DOM or Canvas APIs and run directly in
  Node under Vitest.

## Play

```bash
pnpm install
pnpm dev         # open the printed localhost URL
```

## Requirements

**Playing:** a desktop browser with a keyboard (current Chrome, Firefox, Safari or Edge).
There are no touch controls; on a touch-only device the title screen shows a
keyboard-required notice. Sound starts after your first key press or click, and that first
press on the title screen only turns the sound on.

**Building from source:** Node `>=26` (Lithium LTS) and `pnpm` `>=12` (see `.nvmrc`, `engines`,
and `packageManager` in `package.json`). Dependency install scripts are disabled by default
via `pnpm-workspace.yaml`.

## Controls

| Keys | Action |
|------|--------|
| `W A S D` / arrow keys | Move |
| `E` / `Space` | Interact: enter a village, resupply at a fort, board your ship, make landfall, or sail home to Spain from the western edge |
| `1` / `2` / `3` / `4` | In a parley: trade / gift / attack / amaze |
| `F` | Found a mission fort where you stand (on land only; gathers food and eases fear) |
| `B` | Make camp / bivouac (on land only; trades provisions & half a day to restore morale) |
| `Esc` | Walk away from a parley or leave a village; on the map, save and return to the title |
| `M` | Sound on / off (remembered between visits) |
| `Enter` | Outfit a new expedition (title) · set sail (outfitting) · outfit the next voyage (Spain) · start a new expedition (game over) |
| `C` | Continue your saved expedition (title screen) |
| `R` | Roll a new world (title screen) |
| `↑ ↓` / `← →` | Choose a line / adjust it (outfitting screen) |

- Menus are clickable too: the title lines, the outfitting rows, their `<` `>` arrows and
  the set-sail line, the parley choices and walk-away line, and the Enter lines in Spain
  and at game over.
- `W A S D` move by key position on QWERTY, AZERTY and similar layouts. On Colemak or
  Dvorak some of those keys are command letters, so move with the arrow keys.
- Holding `←` or `→` on the outfitting screen repeats the adjustment.
- During an expedition the game pauses when the window loses focus or the tab is hidden.
  The next key or click resumes play and does nothing else.
- If the game hits an error it shows a recovery card: `Esc` reloads to the title, `X`
  discards the save and reloads.

## How it plays

**The New World.** Each seed carves an Americas in miniature: one continent running the
length of the map, a mountain cordillera down its spine feeding the rivers, and an island
arc off the west coast between the mainland and the open Atlantic that leads home. The fog
lifts as you travel and what you chart stays on your map and minimap.

**Getting around.** Terrain sets your pace: forest and jungle are slow, mountains are
impassable. Step onto a river and the expedition takes to canoes, the fastest way inland.
Your caravel waits offshore; board it at the coast and sail to any other shore. At sea the
wind wanders: run before it for extra speed or beat into it at a crawl (a compass shows it
while you sail). Storms roam the ocean; inside one the helm barely answers, morale bleeds
and crew wash overboard.

**Outfitting in Spain.** The Crown grants a budget that you split between food, trade
goods, crew and caravels. At least one caravel is required, at 100 gold each; whatever you
do not spend sails with you as gold. The budget rises with each rank you earn. The screen
shows how many days your larder will feed the crew you have chosen.

**Villages.** Entering a village puts you on foot among its people; cross to the chief to
open the parley.
- **Trade** spends trade goods for gold and a few provisions; a thin pack earns less, and
  friendlier peoples pay better.
- **Gift** spends a few goods for goodwill and morale, and the elders share compass-bearing
  rumors (direction, rough leagues, and charted fog) toward the nearest City of Gold you have
  not found.
- **Attack** seizes all their gold-tone at the cost of crew and morale.
- **Amaze** stages a free, gleaming gold-tone spectacle — warms wary villages without spending
  goods, though trying it on a hostile crowd is a gamble.

A village can be traded with or raided only once; gifts and amazement leave it open for a later trade.

**Hostility.** Some peoples want no strangers at all. Your violence turns more villages
against you: every attack spreads fear across the whole New World and sours every
village's welcome and trade terms. Gifts soften them, warming that village and slowly
easing the fear. In a hostile village the people close in, and if they catch you three
times they drive you out, costing crew and morale.

**Mission forts & camping.** Press `F` on land to found a fort. It costs 250 gold and needs 5 men,
of whom 3 stay behind as its garrison. Forts cannot be raised on a village's doorstep or
close to another fort. Each eases local fear and gathers provisions over time; press `E`
beside one to carry off its stores. Forts stand for the rest of your career. Press `B` on
land to pitch camp, trading 18 provisions and half a day to restore crew morale.

**Returning to Spain.** Sail to the western edge of the map and press `E`. Your gold is
banked with the Crown, ranks are conferred as your treasury grows, and you outfit the next
voyage to the same New World, with your map, forts and reputation intact. Leftover stores
stay behind and your caravels return to Palos, sailing again from the original landing.
During a voyage each caravel waits wherever you moor it.

**Winning and losing.** Reaching all seven Cities of Gold wins. The expedition is lost if
the crew or morale reaches zero; running out of food starves both. Your score counts gold
(including gold banked in Spain), land charted and peoples met, less a charge for each day
at large.

**Saves.** The expedition autosaves as you play; `Esc` saves and returns to the title, and
`C` picks it back up. There is one save slot, stored in this browser only. Setting sail on
a new expedition replaces it. When an expedition ends its save clears and the result is
recorded in the Chronicle on the title screen. If the game is open in two tabs, only the
tab that saved last keeps saving. Clearing this site's data erases the save, your rank and the
Chronicle, and so can Safari, after seven days of Safari use without a visit to the site.

**The HUD.**
- **Food** is provisions; it turns amber with a `!` when running short and red when low.
- **Goods** are trade goods; `!` means less than one full trade's worth.
- **Crew** and **Morale**: if either reaches zero, the expedition is lost.
- **Gold** is in hand; **Bank** appears once you have banked gold in Spain.
- **Fear** appears once you have used force; `!` means word of your violence runs high.
- **Day** and **Cities** found out of seven.

## Tech

Vanilla TypeScript 7, Vite 8 (Rolldown), Vitest 5, and pnpm 12 on Node 26 LTS, drawn to a
Canvas with a fixed-timestep loop. Zero runtime dependencies and zero asset files: all art,
sound effects, ambience and the title-screen score are generated procedurally with Canvas 2D
and WebAudio.

## Project layout

```
src/
  world/    seeded world generation: rng, noise, terrain, villages, fog, coast   (pure)
  game/     game rules: state, movement, ships, weather, parley, walk-in,
            outfitting, career, forts, lore, saves, chronicle                   (pure)
  audio/    director.ts and scene.ts decide cues and ambience (pure); score.ts is
            the music as data; player.ts, music.ts and texture.ts synthesize with WebAudio
  art/      procedural tileset, terrain relief, sprites and paper, baked at boot
  engine/   loop, input, camera, renderer
  ui/       canvas-drawn HUD, screens, parley panel, walk-in scene, click regions
  app/      the shell's seams: storage (localStorage), viewport (canvas sizing),
            lifecycle (pure pause/crash/gesture rules), devhooks (dev-only audio probes)
  main.ts   app shell: screen flow, per-screen update/render, saves, audio wiring,
            and the dev-only __dbg hook
tests/      Vitest unit tests, run in Node
scripts/    check-dist.mjs, the production-bundle check
docs/plans/ historical design notes, superseded by the code
```

Pure modules never import DOM or canvas code, so they run under Vitest in Node.

## Deploy

`pnpm build` writes `dist/`. The build uses relative paths, so it works from any
subfolder on any static host (an itch.io HTML upload, GitHub Pages, Netlify).

It must be served over HTTP: use `pnpm preview` locally, or any static server. Opening
`dist/index.html` from disk (`file://`) shows a blank page because browsers block module
scripts there.

Saves live in `localStorage`, which is per origin: each host, and each port on localhost,
keeps its own saves.

## Development

```bash
pnpm dev            # dev server with hot reload
pnpm typecheck      # tsc (TypeScript 7)
pnpm test           # vitest run
pnpm build          # typecheck, then production build to dist/
pnpm preview        # serve dist/ over HTTP
pnpm check          # typecheck + tests + build + dev-hook strip check (what CI runs)
```

Settled rules:
- Pure modules (`world/`, `game/`, `app/lifecycle`, the audio director, scene and score) stay DOM-free.
- Zero asset files: art and sound are generated in code.
- Pixel art renders at an integer zoom with smoothing off.
- Composed music plays on the title screen only; the rest is ambient soundscape.
- `window.__dbg`, the automated playthrough bot's API, is a stable DEV-only interface:
  entries are added, never renamed or removed, and production builds strip it
  (`pnpm check` verifies this).

## Credits and disclaimer

Based on *The Seven Cities of Gold* (1984), designed by Danielle Bunten Berry at Ozark
Softscape and published by Electronic Arts.

*Six Seven Cities of Gold Tone Metal* is an unofficial fan tribute. It is not affiliated
with or endorsed by Electronic Arts. All trademarks belong to their respective owners.

## License

MIT. See [LICENSE](LICENSE).
