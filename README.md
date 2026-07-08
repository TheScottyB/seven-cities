# Seven Cities of Gold

A modern browser clone of *The Seven Cities of Gold* (Ozark Softscape / EA, 1984).

You are a conquistador making landfall in a procedurally-generated New World. Chart the
unknown coast and interior, find native villages, and gather gold — while managing a
dwindling supply of food, crew, and morale. Discover all **seven fabled Cities of Gold**
before your expedition collapses.

## Play

```bash
npm install
npm run dev      # open the printed localhost URL
```

## Controls

| Keys | Action |
|------|--------|
| `W A S D` / arrows | Move (real-time) |
| `E` / `Space` | Approach a village · board your ship · make landfall |
| `1` / `2` / `3` | Trade / Gift / Attack |
| `Esc` | Walk away from a village · save & return to menu |
| `Enter` | Outfit a new expedition / set sail |
| `C` | Continue your saved expedition (title screen) |
| `↑↓ ←→` | Choose and adjust line items (outfitting screen) |

## Gameplay

- **Sail between landmasses:** your caravel waits offshore where you landed. Board it at
  the coast (`E`), sail the open ocean (faster than marching, same hungry crew), and step
  ashore on any coastline — islands can hide villages and Cities of Gold.
- **Outfit in Spain:** the Crown grants 500 gold. Split it between food, trade goods, and
  crew — whatever is left sails with you as starting gold. Trade goods are the currency of
  the New World: trading consumes 25 (a thinner pack earns less), gifting consumes 10.
- **Explore** a real-time, smooth-scrolling tile map. Fog of war lifts as you travel and
  the territory you've charted stays on your map (and minimap, where discovered villages
  appear as dots — gold for Cities of Gold).
- **Villages** each have a hidden temperament and wealth:
  - **Trade** — goods for gold and provisions; rates are better with friendly villages.
  - **Gift** — spend goods for goodwill, morale, and *rumors* that chart the land around
    the nearest unfound City of Gold.
  - **Attack** — seize all their gold, but risk your crew and morale.
- **Resources:** food drains as your crew eats; run out and they starve. Losing all crew or
  all morale ends the expedition.
- **Saves:** the expedition autosaves as you travel; quit with Esc and pick it back up with
  `C` on the title screen. The save clears when the expedition ends.
- **Win** by reaching all 7 Cities of Gold. Your score rewards gold, territory charted, and
  villages contacted, minus the days spent.

## Tech

Vanilla TypeScript + Vite, rendered to an HTML5 Canvas with a hand-rolled fixed-timestep
game loop. Pixel-art tiles are generated procedurally. Pure game logic (world generation,
fog, resources, encounters, movement) is decoupled from rendering and unit-tested with Vitest.

```bash
npm run test     # run the unit tests
npm run build    # production build
```

## Project layout

```
src/
  engine/   loop, input, camera, renderer  (rendering + I/O)
  world/    rng, noise, tiles, mapgen, villages, fog  (pure, seeded)
  game/     state, explorer, encounter  (pure game rules)
  ui/       hud, panels
  art/      procedural tileset + sprites
  main.ts   wires it all together
docs/plans/ design + implementation plan
```

See [`docs/plans/`](docs/plans/) for the design document and the task-by-task implementation plan.
