# Seven Cities of Gold Clone — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-based, real-time exploration clone of *The Seven Cities of Gold* — procedural fog-of-war map, village encounters (trade/gift/attack), resource management, win by finding 7 golden cities.

**Architecture:** Vanilla TypeScript with a hand-rolled `requestAnimationFrame` game loop rendering pixel-art tiles to an HTML5 Canvas. Pure game logic (`world/`, `game/`) is decoupled from rendering (`engine/renderer`, `ui/`) so it's unit-testable without a canvas. Deterministic, seeded RNG makes maps reproducible and testable.

**Tech Stack:** TypeScript, Vite (dev server + build), Vitest (unit tests), HTML5 Canvas 2D. No game framework.

---

## Conventions for the implementing engineer

- **TDD always:** write the failing test, watch it fail, write minimal code, watch it pass, commit. Use `superpowers:test-driven-development`.
- **Run tests with:** `npx vitest run <path>` (single file) or `npx vitest run` (all).
- **Commit after every green step.** Small commits.
- All pure logic lives under `src/world/` and `src/game/` and must have **zero imports from `engine/`, `ui/`, `art/`, or the DOM** — this is what keeps it testable.
- Coordinates: `x` = column (east+), `y` = row (south+). World is a flat `Uint8Array`/typed arrays indexed `y * width + x`.

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`
- Create: `.gitignore` (already exists — verify `node_modules/` and `dist/` present)

**Step 1:** Initialize npm project and install deps.
```bash
cd /Users/scottybe/workspace/seven-cities
npm init -y
npm install -D typescript vite vitest
```

**Step 2:** Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

**Step 3:** Create `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
export default defineConfig({
  test: { globals: true, environment: 'node' },
})
```

**Step 4:** Create `index.html`:
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Seven Cities of Gold</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0a0a12; overflow: hidden; }
      canvas { display: block; image-rendering: pixelated; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**Step 5:** Create a placeholder `src/main.ts`:
```ts
const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
canvas.width = 960
canvas.height = 600
ctx.fillStyle = '#123'
ctx.fillRect(0, 0, canvas.width, canvas.height)
ctx.fillStyle = '#eee'
ctx.font = '20px monospace'
ctx.fillText('Seven Cities of Gold — booting…', 24, 40)
```

**Step 6:** Add npm scripts to `package.json`: `"dev": "vite"`, `"build": "vite build"`, `"test": "vitest run"`.

**Step 7:** Verify: `npm run dev` serves a page showing the boot text. Then commit.
```bash
git add -A && git commit -m "chore: scaffold Vite + TS + Vitest project"
```

---

## Task 1: Seeded RNG (foundation for all procedural logic)

**Files:**
- Create: `src/world/rng.ts`
- Test: `tests/rng.test.ts`

**Step 1: Write failing test** — `tests/rng.test.ts`:
```ts
import { makeRng } from '../src/world/rng'

test('same seed produces identical sequence', () => {
  const a = makeRng(42), b = makeRng(42)
  expect([a(), a(), a()]).toEqual([b(), b(), b()])
})
test('different seeds diverge', () => {
  const a = makeRng(1), b = makeRng(2)
  expect(a()).not.toEqual(b())
})
test('output is in [0,1)', () => {
  const r = makeRng(7)
  for (let i = 0; i < 100; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
})
```

**Step 2:** Run `npx vitest run tests/rng.test.ts` → FAIL (module missing).

**Step 3: Implement** — `src/world/rng.ts` (mulberry32):
```ts
export type Rng = () => number
export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
```

**Step 4:** Run test → PASS. **Step 5:** Commit `feat: seeded RNG`.

---

## Task 2: Tile definitions

**Files:**
- Create: `src/world/tiles.ts`
- Test: `tests/tiles.test.ts`

**Step 1: Failing test** — verify tile properties:
```ts
import { TILE, tileInfo, isWalkable } from '../src/world/tiles'
test('ocean is not walkable on foot', () => {
  expect(isWalkable(TILE.OCEAN)).toBe(false)
})
test('mountain peak is not walkable', () => {
  expect(isWalkable(TILE.MOUNTAIN)).toBe(false)
})
test('grass is walkable and faster than forest', () => {
  expect(isWalkable(TILE.GRASS)).toBe(true)
  expect(tileInfo(TILE.GRASS).speed).toBeGreaterThan(tileInfo(TILE.FOREST).speed)
})
test('every tile has a color', () => {
  for (const key of Object.values(TILE)) {
    expect(tileInfo(key as number).color).toMatch(/^#[0-9a-f]{6}$/i)
  }
})
```

**Step 2:** Run → FAIL.

**Step 3: Implement** — `src/world/tiles.ts`:
```ts
export const TILE = {
  OCEAN: 0, BEACH: 1, GRASS: 2, FOREST: 3, JUNGLE: 4,
  DESERT: 5, HIGHLAND: 6, MOUNTAIN: 7, RIVER: 8,
} as const

export interface TileInfo { color: string; speed: number; walkable: boolean }

const INFO: Record<number, TileInfo> = {
  [TILE.OCEAN]:    { color: '#1b4a8a', speed: 0,   walkable: false },
  [TILE.BEACH]:    { color: '#e0d18a', speed: 1.0, walkable: true },
  [TILE.GRASS]:    { color: '#4c9a3a', speed: 1.0, walkable: true },
  [TILE.FOREST]:   { color: '#2f6b2a', speed: 0.6, walkable: true },
  [TILE.JUNGLE]:   { color: '#1f5230', speed: 0.45, walkable: true },
  [TILE.DESERT]:   { color: '#d9b45a', speed: 0.8, walkable: true },
  [TILE.HIGHLAND]: { color: '#8a7a52', speed: 0.7, walkable: true },
  [TILE.MOUNTAIN]: { color: '#6d6d6d', speed: 0,   walkable: false },
  [TILE.RIVER]:    { color: '#3a7ac0', speed: 0.4, walkable: true },
}
export function tileInfo(t: number): TileInfo { return INFO[t] }
export function isWalkable(t: number): boolean { return INFO[t].walkable }
```

**Step 4:** PASS. **Step 5:** Commit `feat: tile definitions`.

---

## Task 3: Value-noise generator

**Files:**
- Create: `src/world/noise.ts`
- Test: `tests/noise.test.ts`

**Step 1: Failing test:**
```ts
import { makeNoise2D } from '../src/world/noise'
test('deterministic for a seed', () => {
  const n1 = makeNoise2D(5), n2 = makeNoise2D(5)
  expect(n1(3.3, 7.1)).toBeCloseTo(n2(3.3, 7.1), 10)
})
test('output within [0,1]', () => {
  const n = makeNoise2D(9)
  for (let i = 0; i < 200; i++) {
    const v = n(Math.random() * 50, Math.random() * 50)
    expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1)
  }
})
```

**Step 2:** FAIL.

**Step 3: Implement** value noise with bilinear interpolation + fractal octaves — `src/world/noise.ts`:
```ts
import { makeRng } from './rng'
export function makeNoise2D(seed: number, gridSize = 8) {
  const rng = makeRng(seed)
  const size = 256
  const grid = new Float32Array(size * size)
  for (let i = 0; i < grid.length; i++) grid[i] = rng()
  const at = (xi: number, yi: number) => grid[((yi & 255) * size) + (xi & 255)]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const sample = (x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y)
    const fx = smooth(x - x0), fy = smooth(y - y0)
    const v00 = at(x0, y0), v10 = at(x0 + 1, y0)
    const v01 = at(x0, y0 + 1), v11 = at(x0 + 1, y0 + 1)
    const top = v00 + (v10 - v00) * fx, bot = v01 + (v11 - v01) * fx
    return top + (bot - top) * fy
  }
  return (x: number, y: number) => {
    let amp = 1, freq = 1 / gridSize, sum = 0, norm = 0
    for (let o = 0; o < 4; o++) { sum += sample(x * freq, y * freq) * amp; norm += amp; amp *= 0.5; freq *= 2 }
    return sum / norm
  }
}
```

**Step 4:** PASS. **Step 5:** Commit `feat: value-noise generator`.

---

## Task 4: Map generation

**Files:**
- Create: `src/world/mapgen.ts`
- Test: `tests/mapgen.test.ts`

**Step 1: Failing test** — reproducibility + terrain sanity:
```ts
import { generateMap } from '../src/world/mapgen'
import { TILE, isWalkable } from '../src/world/tiles'

test('same seed → identical map', () => {
  const a = generateMap(123), b = generateMap(123)
  expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles))
  expect(a.width).toBe(b.width)
})
test('map has both land and ocean', () => {
  const m = generateMap(123)
  let ocean = 0, land = 0
  for (const t of m.tiles) (t === TILE.OCEAN ? ocean++ : land++)
  expect(ocean).toBeGreaterThan(0); expect(land).toBeGreaterThan(0)
})
test('landing point is on walkable land', () => {
  const m = generateMap(123)
  const i = m.landing.y * m.width + m.landing.x
  expect(isWalkable(m.tiles[i])).toBe(true)
})
```

**Step 2:** FAIL.

**Step 3: Implement** — `src/world/mapgen.ts`. Use two noise fields (elevation, moisture). West edge forced to ocean. Choose a `landing` beach tile on the west-facing coast. Return `{ width, height, tiles: Uint8Array, landing: {x,y}, seed }`.
```ts
import { makeNoise2D } from './noise'
import { TILE } from './tiles'

export interface GameMap {
  width: number; height: number; tiles: Uint8Array; landing: { x: number; y: number }; seed: number
}

export function generateMap(seed: number, width = 256, height = 256): GameMap {
  const elev = makeNoise2D(seed, 12)
  const moist = makeNoise2D(seed ^ 0x9e3779b9, 10)
  const tiles = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // radial falloff so the continent sits in the middle; extra push to ocean near west edge
      const nx = x / width, ny = y / height
      const edge = Math.min(nx, ny, 1 - nx, 1 - ny)
      let e = elev(x, y) * 0.85 + edge * 0.6 - 0.15
      if (nx < 0.12) e -= (0.12 - nx) * 3 // force west ocean for landfall
      const m = moist(x, y)
      tiles[y * width + x] = classify(e, m)
    }
  }
  const landing = findLanding(tiles, width, height)
  return { width, height, tiles, landing, seed }
}

function classify(e: number, m: number): number {
  if (e < 0.30) return TILE.OCEAN
  if (e < 0.34) return TILE.BEACH
  if (e > 0.80) return TILE.MOUNTAIN
  if (e > 0.68) return TILE.HIGHLAND
  if (m < 0.30) return TILE.DESERT
  if (m > 0.72) return TILE.JUNGLE
  if (m > 0.52) return TILE.FOREST
  return TILE.GRASS
}

function findLanding(tiles: Uint8Array, w: number, h: number) {
  const cy = Math.floor(h / 2)
  for (let dy = 0; dy < h; dy++) {
    for (const y of [cy - dy, cy + dy]) {
      if (y < 0 || y >= h) continue
      for (let x = 0; x < w; x++) {
        const t = tiles[y * w + x]
        if (t === TILE.BEACH || t === TILE.GRASS) return { x, y }
      }
    }
  }
  return { x: Math.floor(w / 2), y: cy }
}
```

**Step 4:** PASS. **Step 5:** Commit `feat: procedural map generation`.

> Note: if terrain balance looks off later, tune thresholds in `classify` — keep tests green.

---

## Task 5: Village placement (incl. the 7 golden cities)

**Files:**
- Create: `src/world/villages.ts`
- Test: `tests/villages.test.ts`

**Step 1: Failing test:**
```ts
import { generateMap } from '../src/world/mapgen'
import { placeVillages } from '../src/world/villages'
import { isWalkable } from '../src/world/tiles'

test('places villages on walkable land', () => {
  const m = generateMap(123)
  const vs = placeVillages(m, 20)
  for (const v of vs) expect(isWalkable(m.tiles[v.y * m.width + v.x])).toBe(true)
})
test('exactly 7 golden cities', () => {
  const m = generateMap(123)
  const vs = placeVillages(m, 20)
  expect(vs.filter(v => v.golden).length).toBe(7)
})
test('villages are spaced apart (min distance)', () => {
  const m = generateMap(123)
  const vs = placeVillages(m, 20)
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
    const d = Math.hypot(vs[i].x - vs[j].x, vs[i].y - vs[j].y)
    expect(d).toBeGreaterThanOrEqual(8)
  }
})
test('same seed → same villages', () => {
  const m = generateMap(123)
  expect(placeVillages(m, 20)).toEqual(placeVillages(m, 20))
})
```

**Step 2:** FAIL.

**Step 3: Implement** — `src/world/villages.ts`. Reject candidates on non-walkable tiles, too close to coast, or too close to another village. Mark the 7 highest-wealth as `golden`.
```ts
import { GameMap } from './mapgen'
import { isWalkable, TILE } from './tiles'
import { makeRng } from './rng'

export interface Village {
  x: number; y: number; wealth: number; temperament: number; population: number
  golden: boolean; visited: boolean; depleted: boolean
}

export function placeVillages(map: GameMap, count: number, minDist = 8): Village[] {
  const rng = makeRng(map.seed ^ 0x5bd1e995)
  const vs: Village[] = []
  let attempts = 0
  while (vs.length < count && attempts < count * 200) {
    attempts++
    const x = Math.floor(rng() * map.width), y = Math.floor(rng() * map.height)
    const t = map.tiles[y * map.width + x]
    if (!isWalkable(t) || t === TILE.BEACH) continue
    if (nearCoast(map, x, y)) continue
    if (vs.some(v => Math.hypot(v.x - x, v.y - y) < minDist)) continue
    vs.push({
      x, y,
      wealth: Math.floor(rng() * 400) + 50,
      temperament: rng(),        // 0 hostile … 1 friendly
      population: Math.floor(rng() * 300) + 50,
      golden: false, visited: false, depleted: false,
    })
  }
  // top 7 by wealth become golden cities, and get a wealth boost
  vs.slice().sort((a, b) => b.wealth - a.wealth).slice(0, 7).forEach(v => {
    v.golden = true; v.wealth += 500
  })
  return vs
}

function nearCoast(map: GameMap, x: number, y: number): boolean {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = x + dx, yy = y + dy
    if (xx < 0 || yy < 0 || xx >= map.width || yy >= map.height) continue
    if (map.tiles[yy * map.width + xx] === TILE.OCEAN) return true
  }
  return false
}
```

**Step 4:** PASS. **Step 5:** Commit `feat: village placement with golden cities`.

---

## Task 6: Fog of war

**Files:**
- Create: `src/world/fog.ts`
- Test: `tests/fog.test.ts`

**Step 1: Failing test:**
```ts
import { makeFog, reveal, isSeen } from '../src/world/fog'
test('starts fully unseen', () => {
  const f = makeFog(10, 10)
  expect(isSeen(f, 5, 5)).toBe(false)
})
test('reveal marks a radius seen and it persists', () => {
  const f = makeFog(10, 10)
  reveal(f, 5, 5, 2)
  expect(isSeen(f, 5, 5)).toBe(true)
  expect(isSeen(f, 6, 5)).toBe(true)
  expect(isSeen(f, 9, 9)).toBe(false)
  reveal(f, 0, 0, 1)
  expect(isSeen(f, 5, 5)).toBe(true) // still seen
})
test('counts revealed tiles', () => {
  const f = makeFog(10, 10)
  reveal(f, 5, 5, 1)
  expect(f.revealedCount).toBeGreaterThan(0)
})
```

**Step 2:** FAIL.

**Step 3: Implement** — `src/world/fog.ts`:
```ts
export interface Fog { width: number; height: number; seen: Uint8Array; revealedCount: number }
export function makeFog(width: number, height: number): Fog {
  return { width, height, seen: new Uint8Array(width * height), revealedCount: 0 }
}
export function reveal(fog: Fog, cx: number, cy: number, radius: number): void {
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (dx * dx + dy * dy > radius * radius) continue
    const x = cx + dx, y = cy + dy
    if (x < 0 || y < 0 || x >= fog.width || y >= fog.height) continue
    const i = y * fog.width + x
    if (!fog.seen[i]) { fog.seen[i] = 1; fog.revealedCount++ }
  }
}
export function isSeen(fog: Fog, x: number, y: number): boolean {
  return fog.seen[y * fog.width + x] === 1
}
```

**Step 4:** PASS. **Step 5:** Commit `feat: fog of war`.

---

## Task 7: Game state + resource ticking

**Files:**
- Create: `src/game/state.ts`
- Test: `tests/state.test.ts`

**Step 1: Failing test:**
```ts
import { makeState, tick, GameStatus } from '../src/game/state'

function base() {
  return makeState({ food: 100, crew: 100, morale: 100 })
}
test('food drains over time', () => {
  const s = base(); const before = s.food
  tick(s, 10) // 10 seconds
  expect(s.food).toBeLessThan(before)
})
test('starvation costs crew and morale', () => {
  const s = base(); s.food = 0
  tick(s, 5)
  expect(s.crew).toBeLessThan(100)
  expect(s.morale).toBeLessThan(100)
})
test('zero crew → game over', () => {
  const s = base(); s.crew = 0
  tick(s, 1)
  expect(s.status).toBe(GameStatus.Lost)
})
test('zero morale → mutiny lost', () => {
  const s = base(); s.morale = 0
  tick(s, 1)
  expect(s.status).toBe(GameStatus.Lost)
})
test('finding 7 cities → won', () => {
  const s = base(); s.citiesFound = 7
  tick(s, 1)
  expect(s.status).toBe(GameStatus.Won)
})
```

**Step 2:** FAIL.

**Step 3: Implement** — `src/game/state.ts`:
```ts
export enum GameStatus { Playing, Won, Lost }
export interface GameState {
  food: number; crew: number; gold: number; morale: number
  day: number; elapsed: number; citiesFound: number
  villagesContacted: number; status: GameStatus
}
const FOOD_PER_SEC = 0.5
const SECONDS_PER_DAY = 20

export function makeState(init: Partial<GameState> = {}): GameState {
  return {
    food: 500, crew: 100, gold: 0, morale: 100,
    day: 1, elapsed: 0, citiesFound: 0, villagesContacted: 0,
    status: GameStatus.Playing, ...init,
  }
}

export function tick(s: GameState, dt: number): void {
  if (s.status !== GameStatus.Playing) return
  s.elapsed += dt
  s.day = 1 + Math.floor(s.elapsed / SECONDS_PER_DAY)
  const eaten = FOOD_PER_SEC * dt * (s.crew / 100)
  s.food = Math.max(0, s.food - eaten)
  if (s.food <= 0) {
    s.crew = Math.max(0, s.crew - dt * 2)
    s.morale = Math.max(0, s.morale - dt * 3)
  }
  s.crew = Math.max(0, s.crew); s.morale = Math.max(0, s.morale)
  if (s.citiesFound >= 7) { s.status = GameStatus.Won; return }
  if (s.crew <= 0 || s.morale <= 0) { s.status = GameStatus.Lost }
}
export function score(s: GameState, tilesCharted: number): number {
  return Math.floor(s.gold + tilesCharted * 0.5 + s.villagesContacted * 20 - s.day * 5)
}
```

**Step 4:** PASS. **Step 5:** Commit `feat: game state and resource ticking`.

---

## Task 8: Encounter resolution (trade / gift / attack)

**Files:**
- Create: `src/game/encounter.ts`
- Test: `tests/encounter.test.ts`

**Step 1: Failing test:**
```ts
import { makeState } from '../src/game/state'
import { resolveTrade, resolveGift, resolveAttack } from '../src/game/encounter'
import type { Village } from '../src/world/villages'

function village(over: Partial<Village> = {}): Village {
  return { x: 0, y: 0, wealth: 200, temperament: 0.8, population: 100, golden: false, visited: false, depleted: false, ...over }
}
test('friendly trade gains gold and food, depletes village', () => {
  const s = makeState(); const v = village({ temperament: 0.9, wealth: 200 })
  resolveTrade(s, v, () => 0.5)
  expect(s.gold).toBeGreaterThan(0)
  expect(v.depleted).toBe(true)
  expect(s.villagesContacted).toBe(1)
})
test('gift raises temperament and morale, no gold', () => {
  const s = makeState(); const v = village({ temperament: 0.3 })
  const before = v.temperament, goldBefore = s.gold
  resolveGift(s, v)
  expect(v.temperament).toBeGreaterThan(before)
  expect(s.morale).toBeGreaterThanOrEqual(100) // capped at 100
  expect(s.gold).toBe(goldBefore)
})
test('attack on hostile village can cost crew', () => {
  const s = makeState(); const v = village({ temperament: 0.05, population: 300, wealth: 300 })
  resolveAttack(s, v, () => 0.99) // bad roll
  expect(s.crew).toBeLessThan(100)
  expect(v.depleted).toBe(true)
})
test('golden city trade increments citiesFound', () => {
  const s = makeState(); const v = village({ golden: true })
  resolveTrade(s, v, () => 0.5)
  expect(s.citiesFound).toBe(1)
})
test('depleted village cannot be re-traded', () => {
  const s = makeState(); const v = village({ depleted: true })
  const g = s.gold
  resolveTrade(s, v, () => 0.5)
  expect(s.gold).toBe(g)
})
```

**Step 2:** FAIL.

**Step 3: Implement** — `src/game/encounter.ts`. `roll` is an injectable `() => number` (defaults to `Math.random`) so outcomes are testable.
```ts
import { GameState } from './state'
import type { Village } from '../world/villages'

type Roll = () => number
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function contact(s: GameState, v: Village) {
  if (!v.visited) { v.visited = true; s.villagesContacted++ }
  if (v.golden && !v.depleted) s.citiesFound++
}

export function resolveTrade(s: GameState, v: Village, roll: Roll = Math.random): void {
  if (v.depleted) return
  contact(s, v)
  const rate = 0.3 + v.temperament * 0.7
  const gold = Math.floor(v.wealth * rate * (0.6 + roll() * 0.4))
  s.gold += gold
  s.food += Math.floor(gold * 0.3)
  s.morale = clamp(s.morale + 3, 0, 100)
  v.depleted = true
}

export function resolveGift(s: GameState, v: Village): void {
  if (v.depleted) return
  contact(s, v)
  v.temperament = clamp(v.temperament + 0.25, 0, 1)
  s.morale = clamp(s.morale + 6, 0, 100)
  // gifts don't deplete the village — it can still be traded later
}

export function resolveAttack(s: GameState, v: Village, roll: Roll = Math.random): void {
  if (v.depleted) return
  contact(s, v)
  const defense = (1 - v.temperament) * 0.5 + (v.population / 400) * 0.5
  const losses = Math.floor(roll() * defense * 40)
  s.crew = clamp(s.crew - losses, 0, 100)
  s.gold += v.wealth // seize it all
  s.morale = clamp(s.morale - 8, 0, 100)
  v.depleted = true
}
```

**Step 4:** PASS. **Step 5:** Commit `feat: encounter resolution`.

---

## Task 9: Explorer movement (pure logic)

**Files:**
- Create: `src/game/explorer.ts`
- Test: `tests/explorer.test.ts`

**Step 1: Failing test:**
```ts
import { generateMap } from '../src/world/mapgen'
import { makeExplorer, moveExplorer } from '../src/game/explorer'
import { TILE, isWalkable } from '../src/world/tiles'

test('starts at landing point', () => {
  const m = generateMap(123); const e = makeExplorer(m)
  expect(e.x).toBeCloseTo(m.landing.x); expect(e.y).toBeCloseTo(m.landing.y)
})
test('cannot move onto ocean/impassable', () => {
  const m = generateMap(123); const e = makeExplorer(m)
  // hammer west (toward ocean) many times
  for (let i = 0; i < 1000; i++) moveExplorer(m, e, -1, 0, 0.1)
  expect(isWalkable(m.tiles[Math.floor(e.y) * m.width + Math.floor(e.x)])).toBe(true)
})
test('stays within bounds', () => {
  const m = generateMap(123); const e = makeExplorer(m)
  for (let i = 0; i < 5000; i++) moveExplorer(m, e, 1, 1, 0.5)
  expect(e.x).toBeGreaterThanOrEqual(0); expect(e.x).toBeLessThan(m.width)
  expect(e.y).toBeGreaterThanOrEqual(0); expect(e.y).toBeLessThan(m.height)
})
```

**Step 2:** FAIL.

**Step 3: Implement** — `src/game/explorer.ts`. Movement scaled by tile speed; reject moves onto non-walkable tiles (slide along walls by trying axes independently).
```ts
import { GameMap } from '../world/mapgen'
import { tileInfo, isWalkable } from '../world/tiles'

export interface Explorer { x: number; y: number; baseSpeed: number }
export function makeExplorer(map: GameMap): Explorer {
  return { x: map.landing.x + 0.5, y: map.landing.y + 0.5, baseSpeed: 6 }
}
function walkableAt(map: GameMap, x: number, y: number): boolean {
  const xi = Math.floor(x), yi = Math.floor(y)
  if (xi < 0 || yi < 0 || xi >= map.width || yi >= map.height) return false
  return isWalkable(map.tiles[yi * map.width + xi])
}
export function moveExplorer(map: GameMap, e: Explorer, dx: number, dy: number, dt: number): void {
  if (dx === 0 && dy === 0) return
  const len = Math.hypot(dx, dy); dx /= len; dy /= len
  const here = tileInfo(map.tiles[Math.floor(e.y) * map.width + Math.floor(e.x)])
  const step = e.baseSpeed * (here.speed || 1) * dt
  const nx = e.x + dx * step, ny = e.y + dy * step
  if (walkableAt(map, nx, e.y)) e.x = nx
  if (walkableAt(map, e.x, ny)) e.y = ny
}
```

**Step 4:** PASS. **Step 5:** Commit `feat: explorer movement`.

---

## Task 10: Procedural pixel tileset (rendering asset)

**Files:**
- Create: `src/art/tileset.ts`
- (No unit test — visual asset. Verified in browser.)

**Step 1: Implement** — draw each tile type as a `TILE_PX`×`TILE_PX` (e.g. 16px) offscreen canvas with base color + a little procedural texture (dithered noise / dots for forests, wave lines for ocean). Export `getTileCanvas(tileType)` returning an `HTMLCanvasElement`. Build all tiles once at startup into a `Map<number, HTMLCanvasElement>`.

**Step 2:** Manual verify after Task 12 wires rendering. Commit `feat: procedural pixel tileset`.

> This is the one place to iterate on aesthetics. Keep each tile readable at a glance and distinct from its neighbors.

---

## Task 11: Engine — input, camera, loop

**Files:**
- Create: `src/engine/input.ts`, `src/engine/camera.ts`, `src/engine/loop.ts`
- (No unit tests — thin DOM adapters. Behavior verified in browser.)

**input.ts:** track a `Set<string>` of held keys via `keydown`/`keyup`; expose `axis()` → `{dx, dy}` from WASD/arrows, and `pressed(key)` edge-detection for E/Space/1/2/3/Esc.

**camera.ts:** `{ x, y }` centered on the explorer, clamped so the view never scrolls past map edges. `worldToScreen` / `screenToWorld` helpers using `TILE_PX`.

**loop.ts:** fixed-timestep accumulator (`update(dt)` at 60Hz) + `render()` each animation frame via `requestAnimationFrame`. Accepts `update`/`render` callbacks.

Commit `feat: engine input/camera/loop`.

---

## Task 12: Renderer

**Files:**
- Create: `src/engine/renderer.ts`
- (Manual verification.)

Draw only tiles within the camera viewport (culling). For each visible tile:
- If unseen in fog → fill black.
- If seen → draw its tile canvas; if not currently in view-radius of the explorer, overlay a translucent dark rect (dimmed "charted but not present" look).
Draw village sprites (only if their tile is seen), then the explorer sprite on top. Commit `feat: viewport renderer with fog`.

---

## Task 13: HUD + panels (UI)

**Files:**
- Create: `src/ui/hud.ts`, `src/ui/panels.ts`
- (Manual verification.)

**hud.ts:** draw the top bar — Food, Crew, Gold, Morale, Day, "Cities X/7" — as canvas text/bars.
**panels.ts:** `drawStartScreen`, `drawEncounter(village)` (shows Trade/Gift/Attack with 1/2/3 hints), `drawGameOver(score)`, `drawVictory(score)`.

Commit `feat: HUD and panels`.

---

## Task 14: Wire it all together in main.ts

**Files:**
- Modify: `src/main.ts` (replace placeholder)

Compose everything into the game:
1. Read seed (default `"1492"`); `generateMap`, `placeVillages`, `makeFog`, `makeState`, `makeExplorer`, build tileset.
2. Screen state machine: `start → playing → (won | lost)`.
3. In `update(dt)` while playing: read input axis → `moveExplorer`; `reveal` fog around explorer (radius ~5); `tick` state; detect adjacency to a non-depleted village → if action key pressed, open encounter panel (freeze movement); handle 1/2/3 → call `resolveTrade/Gift/Attack`, then close panel; on `status` change, switch screens.
4. In `render()`: camera follow → renderer → HUD → active panel.
5. Resize canvas to window; Esc pauses/closes panel; on victory/game-over, key restarts with a new seed.

**Verify (manual):** `npm run dev`, play through — move around, reveal map, find a village, trade/gift/attack, watch food drain, reach a golden city, trigger win and loss. Confirm no console errors.

Commit `feat: wire up full game loop`.

---

## Task 15: Final pass — full test run, README, tuning

**Files:**
- Create: `README.md` (how to run, controls, goal)

**Step 1:** `npm run test` → all green.
**Step 2:** `npm run build` → succeeds with no type errors.
**Step 3:** Playtest and tune constants (food drain rate, reveal radius, village count/spacing, trade rates) for a fun ~5–10 min session. Keep tests green.
**Step 4:** Write `README.md`. Commit `docs: add README` and `chore: gameplay tuning`.

---

## Definition of done

- `npm run test` passes (rng, tiles, noise, mapgen, villages, fog, state, encounter, explorer).
- `npm run build` produces a clean production build.
- `npm run dev` gives a playable game: explore a fog-of-war map, encounter villages, manage resources, win by finding 7 cities or lose by running out of crew/morale/food.
- Pure logic has no DOM/render imports.
