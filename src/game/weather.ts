import type { GameMap } from '../world/mapgen'
import { makeRng } from '../world/rng'
import { TILE } from '../world/tiles'
import type { GameState } from './state'

/**
 * Weather at sea: a slowly wandering global wind and a handful of roaming
 * storm cells. Everything is a pure function of (seed, elapsed game time),
 * so weather needs no save data and restores perfectly with the clock.
 */
export interface StormCell {
  x0: number
  y0: number
  vx: number
  vy: number
  r: number
}

export interface Weather {
  baseAngle: number
  phase: number
  storms: StormCell[]
}

export function makeWeather(seed: number, map: GameMap, stormCount = 4): Weather {
  const rng = makeRng(seed ^ 0x1234abcd)
  const storms: StormCell[] = []
  let attempts = 0
  while (storms.length < stormCount && attempts < 300) {
    attempts++
    const x = rng() * map.width
    const y = rng() * map.height
    if (map.tiles[Math.floor(y) * map.width + Math.floor(x)] !== TILE.OCEAN) continue
    storms.push({
      x0: x,
      y0: y,
      vx: (rng() - 0.5) * 1.2,
      vy: (rng() - 0.5) * 1.2,
      r: 6 + rng() * 4,
    })
  }
  return { baseAngle: rng() * Math.PI * 2, phase: rng() * 10, storms }
}

/** Wind as of game-second t: the direction it BLOWS TOWARD, and 0.1–1 strength. */
export function windAt(w: Weather, t: number): { angle: number; strength: number } {
  const angle = w.baseAngle + 0.9 * Math.sin(t / 47 + w.phase) + 0.6 * Math.sin(t / 13 + w.phase * 2)
  const strength = 0.55 + 0.45 * Math.sin(t / 29 + w.phase)
  return { angle, strength: Math.max(0.1, Math.min(1, strength)) }
}

/** Speed multiplier for sailing a heading under this wind: ~0.55 beating into it, ~1.45 running before it. */
export function windFactor(angle: number, strength: number, dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 1
  const heading = Math.atan2(dy, dx)
  return 1 + 0.45 * strength * Math.cos(heading - angle)
}

const wrap = (v: number, m: number) => ((v % m) + m) % m

export function stormCenter(s: StormCell, t: number, w: number, h: number): { x: number; y: number } {
  return { x: wrap(s.x0 + s.vx * t, w), y: wrap(s.y0 + s.vy * t, h) }
}

export function stormAt(
  weather: Weather,
  t: number,
  w: number,
  h: number,
  x: number,
  y: number,
): boolean {
  for (const s of weather.storms) {
    const c = stormCenter(s, t, w, h)
    if (Math.hypot(c.x - x, c.y - y) <= s.r) return true
  }
  return false
}

/** The sea takes its toll: morale bleeds and crew wash overboard while in a storm. */
export function applyStorm(state: GameState, dt: number): void {
  state.morale = Math.max(0, state.morale - 4 * dt)
  state.crew = Math.max(0, state.crew - 0.25 * dt)
}
