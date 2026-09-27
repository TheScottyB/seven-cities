import type { Village } from '../world/villages'
import { makeRng, type Rng } from '../world/rng'
import { effectiveTemperament, moodOf } from './encounter'
import { facingFrom } from './explorer'
import { Facing, GAIT_CYCLE } from './gait'

/**
 * The walk-in scene: entering a village puts you on foot among its people.
 * Weave through the crowd to reach the chief at the head of the village and
 * the parley opens; walk back out the way you came to leave. If word of your
 * violence has made this people hostile, they converge — get grabbed three
 * times and you are driven out of the village.
 */
export interface Villager {
  x: number
  y: number
  wx: number
  wy: number
  appeased: boolean
}

/** Decorative village furniture — never blocks movement. */
export interface WalkinProp {
  kind: 'fire' | 'pots' | 'rack' | 'crop'
  x: number
  y: number
}

export interface WalkinScene {
  w: number
  h: number
  huts: [number, number][]
  chief: { x: number; y: number }
  px: number
  py: number
  /** which way the conquistador is turned, and how far into his stride */
  facing: number
  gait: number
  /** whether he actually moved this tick; the sprite stands neutral when not */
  moving: boolean
  villagers: Villager[]
  hostile: boolean
  /** effective temperament 0..1 — the renderer tints the light with it */
  mood: number
  /** a City of Gold dresses its roofs accordingly */
  golden: boolean
  props: WalkinProp[]
  caught: number
  t: number
  rng: Rng
}

export type WalkinStatus = 'walking' | 'chief' | 'left' | 'driven-off'

const PLAYER_SPEED = 3.4
const CHASE_SPEED = 2.3
const WANDER_SPEED = 0.8
/** Gait per unit walked. PLAYER_SPEED is slow in units/sec; doubling keeps his cadence near the overworld's. */
const WALKIN_STRIDE = 2

export function makeScene(v: Village, fear: number): WalkinScene {
  const rng = makeRng(((v.x * 7919 + v.y * 104729) ^ 0x5f3759df) >>> 0)
  const w = 15
  const h = 11
  const huts: [number, number][] = []
  const hutCount = 4 + Math.floor(rng() * 3)
  for (let i = 0; i < hutCount; i++) {
    const ang = (i / hutCount) * Math.PI * 2 + rng() * 0.5
    const r = 3 + rng() * 2
    const x = Math.round(w / 2 + Math.cos(ang) * r)
    const y = Math.round(h / 2 + Math.sin(ang) * r * 0.7)
    if (x < 1 || x > w - 2 || y < 2 || y > h - 3) continue
    if (Math.abs(x - w / 2) < 1.5) continue // keep the center path clear
    huts.push([x, y])
  }
  const count = Math.min(12, 3 + Math.floor(v.population / 40))
  const villagers: Villager[] = []
  for (let i = 0; i < count; i++) {
    villagers.push({
      x: 1.5 + rng() * (w - 3),
      y: 2.5 + rng() * (h - 5),
      wx: 0,
      wy: 0,
      appeased: false,
    })
  }

  // village furniture: decorative, deterministic, and always clear of the
  // center path so the way to the chief stays legible
  const props: WalkinProp[] = []
  const clearOfPath = (x: number) => Math.abs(x - w / 2) >= 1.6
  props.push({ kind: 'fire', x: w / 2 + 2.1, y: h / 2 + 0.3 }) // the hearth at the plaza's edge
  huts.slice(0, 3).forEach(([hx, hy], i) => {
    const kind = (['pots', 'rack', 'pots'] as const)[i]
    const px = hx + (hx < w / 2 ? 1.4 : -1.1)
    const py = hy + 1.1
    if (clearOfPath(px) && py < h - 1.2) props.push({ kind, x: px, y: py })
  })
  // the maize patch takes whichever lower corner the huts left open
  const cropX = huts.some(([hx, hy]) => hx < 4 && hy > h - 5) ? w - 2.6 : 2.2
  props.push({ kind: 'crop', x: cropX, y: h - 2.4 })

  const eff = effectiveTemperament(v.temperament, fear)
  return {
    w,
    h,
    huts,
    chief: { x: w / 2, y: 1.5 },
    px: w / 2,
    py: h - 1.2,
    facing: Facing.N, // he enters from the south, looking up the path
    gait: 0,
    moving: false,
    villagers,
    hostile: moodOf(eff) === 'hostile',
    mood: eff,
    golden: v.golden,
    props,
    caught: 0,
    t: 0,
    rng,
  }
}

export function isBlockedAt(s: WalkinScene, x: number, y: number): boolean {
  if (x < 0.4 || y < 0.4 || x > s.w - 0.4) return true // south edge stays open — the way out
  return s.huts.some(([hx, hy]) => Math.abs(x - (hx + 0.5)) < 0.9 && Math.abs(y - (hy + 0.5)) < 0.9)
}

export function tickScene(s: WalkinScene, dx: number, dy: number, dt: number): WalkinStatus {
  s.t += dt
  s.moving = false
  if (dx !== 0 || dy !== 0) {
    const x0 = s.px
    const y0 = s.py
    const len = Math.hypot(dx, dy)
    const nx = s.px + (dx / len) * PLAYER_SPEED * dt
    const ny = s.py + (dy / len) * PLAYER_SPEED * dt
    if (!isBlockedAt(s, nx, s.py)) s.px = nx
    if (!isBlockedAt(s, s.px, ny)) s.py = ny
    // read the turn off what actually happened, not off the keys — sliding
    // along a hut would otherwise face him into the wall
    const ddx = s.px - x0
    const ddy = s.py - y0
    if (ddx !== 0 || ddy !== 0) {
      s.moving = true
      s.facing = facingFrom(ddx, ddy)
      s.gait = (s.gait + Math.hypot(ddx, ddy) * WALKIN_STRIDE) % GAIT_CYCLE
    }
  }
  if (s.py > s.h - 0.3) return 'left'
  if (Math.hypot(s.px - s.chief.x, s.py - s.chief.y) < 0.9) return 'chief'

  for (const vg of s.villagers) {
    if (vg.appeased) continue
    const d = Math.hypot(vg.x - s.px, vg.y - s.py)
    if (s.hostile) {
      if (d > 0.01) {
        vg.x += ((s.px - vg.x) / d) * CHASE_SPEED * dt
        vg.y += ((s.py - vg.y) / d) * CHASE_SPEED * dt
      }
      if (d < 0.5) {
        s.caught++
        vg.appeased = true // this one got their licks in
        if (s.caught >= 3) return 'driven-off'
      }
    } else {
      if (d < 2.2) {
        // shy of the armored stranger — give ground
        vg.x += ((vg.x - s.px) / (d || 1)) * 1.6 * dt
        vg.y += ((vg.y - s.py) / (d || 1)) * 1.6 * dt
      } else {
        if (s.rng() < 0.02) {
          vg.wx = (s.rng() - 0.5) * 2
          vg.wy = (s.rng() - 0.5) * 2
        }
        vg.x += vg.wx * WANDER_SPEED * dt
        vg.y += vg.wy * WANDER_SPEED * dt
      }
      vg.x = Math.max(0.6, Math.min(s.w - 0.6, vg.x))
      vg.y = Math.max(0.6, Math.min(s.h - 0.6, vg.y))
    }
  }
  return 'walking'
}
