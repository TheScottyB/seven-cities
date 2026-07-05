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
| `E` / `Space` | Approach a nearby village |
| `1` / `2` / `3` | Trade / Gift / Attack |
| `Esc` | Walk away from a village |
| `Enter` | Set sail / start a new expedition |

## Gameplay

- **Explore** a real-time, smooth-scrolling tile map. Fog of war lifts as you travel and
  the territory you've charted stays on your map (and minimap).
- **Villages** each have a hidden temperament and wealth:
  - **Trade** — offer goods for gold and food; rates are better with friendly villages.
  - **Gift** — spend goodwill to make a village friendlier (and lift your morale).
  - **Attack** — seize all their gold, but risk your crew and morale.
- **Resources:** food drains as your crew eats; run out and they starve. Losing all crew or
  all morale ends the expedition.
- **Win** by finding all 7 Cities of Gold. Your score rewards gold, territory charted, and
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
