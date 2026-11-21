import { TILE, tileInfo } from '../world/tiles'
import { makeRng } from '../world/rng'
import { DECORS, PHASES, SHADES, framesFor, tileIndex } from './relief'
import { rgbOf } from './pixels'

export const TILE_PX = 16

/**
 * The tile atlas. Every terrain gets a flat run of baked 16x16 canvases
 * indexed on three axes:
 *
 *   decor — which dressing the ground wears (rocks, flowers, driftwood...)
 *   phase — the animated frame (water shimmer, foliage leaning in the wind)
 *   shade — depth band for water, hillshade level for the cordillera
 *
 * Everything that varies per tile position is baked in here at boot, so the
 * per-frame draw loop stays at exactly one drawImage per tile.
 */
export type Tileset = Map<number, HTMLCanvasElement[]>

/**
 * Four bands of sea. Turquoise shallows hug the beaches, grading out through
 * the navy the game was always painted in, into the deep. Shallow water is
 * how a sailor reads "land is near" — this is information, not decoration.
 */
export const DEPTH_RAMP = ['#35899a', '#276b96', '#1e5090', '#1b4680']

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = TILE_PX
  c.height = TILE_PX
  return [c, c.getContext('2d')!]
}

/** shade the base color: amount in [-1, 1], negative darkens */
function shade(hex: string, amount: number): string {
  const ch = (v: number) => {
    const s = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount
    return Math.max(0, Math.min(255, Math.round(s)))
  }
  const [r, g, b] = rgbOf(hex).map(ch)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * Warm toward the sun, cool into shadow — which is what makes relief read as
 * light rather than as a brightness fade. The cool cast stays gentle: push
 * blue hard on a grey mountain and the shadowed faces turn to ice.
 */
function relight(hex: string, amount: number): string {
  const warm = [1.05, 1.0, 0.92]
  const cool = [0.95, 0.985, 1.035]
  const k = amount >= 0 ? warm : cool
  const ch = (v: number, i: number) => {
    const lit = amount < 0 ? v * (1 + amount * 0.55) : v + (255 - v) * amount * 0.5
    return Math.max(0, Math.min(255, Math.round(lit * k[i])))
  }
  const [r, g, b] = rgbOf(hex).map(ch)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * Ground dressings. Each terrain gets props from its OWN hue family — a green
 * blob on grass would read as a tree, and grass-vs-forest is the walk-speed
 * distinction the player navigates by. Props dress a tile; they never re-key
 * its color.
 */
function drawDecor(g: CanvasRenderingContext2D, type: number, decor: number, rng: () => number): void {
  if (decor === 0) return
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color
    g.fillRect(x, y, w, h)
  }
  const jx = 2 + Math.floor(rng() * 9)
  const jy = 3 + Math.floor(rng() * 8)

  switch (type) {
    case TILE.GRASS: {
      if (decor === 1) {
        // a scatter of wildflowers
        for (const [c, col] of [[0, '#e8e07a'], [1, '#d8a0c8'], [2, '#e8e07a']] as const) {
          px(jx + c * 3 - 2, jy + ((c * 5) % 4), 1, 1, col)
        }
      } else if (decor === 2) {
        // a lichen-blotched boulder
        px(jx, jy, 4, 3, '#7a7a72')
        px(jx + 1, jy - 1, 2, 1, '#94948a')
        px(jx, jy + 3, 4, 1, '#4a4a44')
      } else {
        // reeds
        for (let i = 0; i < 3; i++) px(jx + i * 2, jy - 2, 1, 4, '#6a8a3a')
      }
      break
    }
    case TILE.FOREST: {
      if (decor === 1) {
        px(jx, jy, 1, 3, '#3a2a18') // a fallen trunk
        px(jx, jy + 3, 4, 1, '#3a2a18')
      } else if (decor === 2) {
        for (let i = 0; i < 4; i++) px(2 + Math.floor(rng() * 12), 2 + Math.floor(rng() * 12), 1, 1, '#6a4a2a')
      } else {
        px(jx, jy, 2, 2, '#8a3a2a') // a berry thicket
        px(jx + 2, jy + 1, 1, 1, '#8a3a2a')
      }
      break
    }
    case TILE.JUNGLE: {
      if (decor === 1) {
        for (let i = 0; i < 3; i++) px(jx + i, jy - i, 1, 1, '#e8d060') // dappled light
      } else if (decor === 2) {
        px(jx, jy, 1, 5, '#2a3a1a') // a hanging vine
        px(jx + 1, jy + 5, 1, 1, '#2a3a1a')
      } else {
        px(jx, jy, 2, 1, '#c04a8a') // an orchid
        px(jx + 1, jy - 1, 1, 1, '#e88ac0')
      }
      break
    }
    case TILE.DESERT: {
      if (decor === 1) {
        // saguaro — the silhouette that says desert at a glance
        px(jx, jy - 3, 2, 8, '#4e7a3a')
        px(jx - 2, jy - 1, 2, 1, '#4e7a3a')
        px(jx - 2, jy - 3, 1, 3, '#4e7a3a')
        px(jx + 2, jy, 2, 1, '#4e7a3a')
        px(jx + 3, jy - 2, 1, 3, '#4e7a3a')
      } else if (decor === 2) {
        // sun-bleached bones
        px(jx, jy, 5, 1, '#e8e4d8')
        px(jx, jy - 1, 1, 1, '#e8e4d8')
        px(jx + 4, jy - 1, 1, 1, '#e8e4d8')
      } else {
        for (let i = 0; i < 3; i++) px(jx + i * 2, jy + (i % 2), 2, 1, '#b08a4a') // pebbles
      }
      break
    }
    case TILE.BEACH: {
      if (decor === 1) {
        px(jx, jy, 5, 1, '#9a7a52') // driftwood
        px(jx + 1, jy - 1, 1, 1, '#9a7a52')
      } else if (decor === 2) {
        px(jx, jy, 2, 1, '#c9705a') // a shell
        px(jx, jy + 1, 2, 1, '#e0a090')
      } else {
        for (let i = 0; i < 4; i++) px(2 + Math.floor(rng() * 12), 2 + Math.floor(rng() * 12), 1, 1, '#b8a878')
      }
      break
    }
    case TILE.HIGHLAND: {
      if (decor === 1) {
        for (let i = 0; i < 5; i++) px(2 + Math.floor(rng() * 12), 2 + Math.floor(rng() * 12), 2, 1, '#6a5f42') // scree
      } else if (decor === 2) {
        px(jx, jy, 1, 3, '#5a4a32') // dead brush
        px(jx - 1, jy + 1, 3, 1, '#5a4a32')
      } else {
        px(jx, jy, 3, 2, '#9a8a62') // an outcrop
        px(jx, jy - 1, 3, 1, '#a89a72')
      }
      break
    }
    case TILE.MOUNTAIN: {
      if (decor === 1) for (let i = 0; i < 3; i++) px(1 + Math.floor(rng() * 13), 11 + Math.floor(rng() * 4), 1, 1, '#575757')
      break
    }
  }
}

/**
 * One baked tile. `phase` leans foliage and cycles water; `shade` selects the
 * depth band or hillshade level.
 *
 * The rng is seeded from (type, decor) ONLY — never phase — so every animated
 * frame of the same tile scatters its texture identically and only the parts
 * we deliberately move actually move. If a future edit puts an rng() call
 * inside a branch that tests phase, the stream diverges between frames and the
 * whole world boils.
 */
function drawTile(type: number, decor: number, phase: number, shadeIdx: number): HTMLCanvasElement {
  const [c, g] = makeCanvas()
  let base = tileInfo(type).color
  if (type === TILE.OCEAN) base = DEPTH_RAMP[shadeIdx]
  if (type === TILE.HIGHLAND || type === TILE.MOUNTAIN) {
    base = relight(base, (shadeIdx - 1) * 0.16)
  }
  g.fillStyle = base
  g.fillRect(0, 0, TILE_PX, TILE_PX)
  const rng = makeRng((type * 131 + decor) * 2654435761)
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color
    g.fillRect(x, y, w, h)
  }
  // foliage leans with the wind: -1, 0, +1 columns
  const lean = phase === 0 ? 0 : phase === 1 ? -1 : 1

  switch (type) {
    case TILE.OCEAN: {
      const light = shade(base, 0.16)
      const dark = shade(base, -0.18)
      for (let i = 0; i < 3; i++) {
        const y = (phase * 2 + i * 5 + Math.floor(rng() * 2)) % TILE_PX
        px(Math.floor(rng() * 11), y, 5, 1, light)
        px(Math.floor(rng() * 12), (y + 3) % TILE_PX, 4, 1, dark)
      }
      break
    }
    case TILE.RIVER: {
      px(0, 0, TILE_PX, TILE_PX, shade(base, 0.08))
      const light = shade(base, 0.32)
      for (let i = 0; i < 3; i++) {
        const y = (phase * 3 + i * 5) % TILE_PX
        px(2 + Math.floor(rng() * 4), y, 4, 1, light)
      }
      break
    }
    case TILE.BEACH: {
      const dark = shade(base, -0.14)
      const light = shade(base, 0.22)
      for (let i = 0; i < 7; i++) px(Math.floor(rng() * 16), Math.floor(rng() * 16), 1, 1, dark)
      for (let i = 0; i < 4; i++) px(Math.floor(rng() * 16), Math.floor(rng() * 16), 1, 1, light)
      break
    }
    case TILE.GRASS: {
      const dark = shade(base, -0.2)
      const light = shade(base, 0.18)
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(rng() * 15)
        const y = Math.floor(rng() * 14)
        px(x, y, 1, 2, dark) // grass tufts
      }
      for (let i = 0; i < 3; i++) px(Math.floor(rng() * 16), Math.floor(rng() * 16), 1, 1, light)
      break
    }
    case TILE.FOREST: {
      // real mini-pines on a grass floor, crowns tipping with the wind
      px(0, 0, TILE_PX, TILE_PX, shade('#4c9a3a', -0.25))
      const trees = 3
      for (let t = 0; t < trees; t++) {
        const tx = 2 + Math.floor(rng() * 11)
        const ty = 4 + Math.floor(rng() * 8)
        px(tx + 1, ty + 3, 1, 2, '#4a2f18') // trunk
        g.fillStyle = shade(base, t % 2 ? 0.12 : -0.1)
        g.beginPath()
        g.moveTo(tx - 1.5, ty + 3)
        g.lineTo(tx + 1.5 + lean * 2, ty - 3)
        g.lineTo(tx + 4.5, ty + 3)
        g.closePath()
        g.fill()
      }
      break
    }
    case TILE.JUNGLE: {
      // dense broadleaf canopy: overlapping blobs, vivid highlights
      const light = shade(base, 0.25)
      const dark = shade(base, -0.3)
      for (let i = 0; i < 5; i++) {
        g.fillStyle = i % 2 ? dark : shade(base, 0.08)
        g.beginPath()
        g.arc(2 + rng() * 12 + lean * 1.4, 2 + rng() * 12, 2.4 + rng() * 1.6, 0, Math.PI * 2)
        g.fill()
      }
      for (let i = 0; i < 4; i++) px(Math.floor(rng() * 16) + lean, Math.floor(rng() * 16), 1, 1, light)
      break
    }
    case TILE.DESERT: {
      // dune ridges
      const dark = shade(base, -0.15)
      for (let i = 0; i < 2; i++) {
        const y = 3 + i * 7
        g.strokeStyle = dark
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(0, y)
        g.quadraticCurveTo(8, y - 3, 16, y)
        g.stroke()
      }
      break
    }
    case TILE.HIGHLAND: {
      const dark = shade(base, -0.25)
      const light = shade(base, 0.15)
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(rng() * 12)
        const y = Math.floor(rng() * 12)
        px(x, y + 1, 3, 2, dark) // stones
        px(x, y, 3, 1, light)
      }
      break
    }
    case TILE.MOUNTAIN: {
      // shaded peak with a snowcap
      px(0, 0, TILE_PX, TILE_PX, shade(base, -0.2))
      g.fillStyle = base
      g.beginPath()
      g.moveTo(1, 14)
      g.lineTo(8, 2)
      g.lineTo(15, 14)
      g.closePath()
      g.fill()
      g.fillStyle = shade(base, -0.35) // shadowed east face
      g.beginPath()
      g.moveTo(8, 2)
      g.lineTo(15, 14)
      g.lineTo(8, 14)
      g.closePath()
      g.fill()
      g.fillStyle = '#e8ecf2' // snowcap
      g.beginPath()
      g.moveTo(6, 5.5)
      g.lineTo(8, 2)
      g.lineTo(10, 5.5)
      g.lineTo(8.8, 4.8)
      g.lineTo(7.4, 5.6)
      g.closePath()
      g.fill()
      break
    }
  }

  drawDecor(g, type, decor, rng)
  return c
}

export function buildTileset(): Tileset {
  const set: Tileset = new Map()
  for (const t of Object.values(TILE)) {
    const type = t as number
    const frames: HTMLCanvasElement[] = new Array(framesFor(type))
    for (let d = 0; d < (DECORS[type] ?? 1); d++) {
      for (let p = 0; p < (PHASES[type] ?? 1); p++) {
        for (let s = 0; s < (SHADES[type] ?? 1); s++) {
          frames[tileIndex(type, d, p, s)] = drawTile(type, d, p, s)
        }
      }
    }
    set.set(type, frames)
  }
  return set
}
