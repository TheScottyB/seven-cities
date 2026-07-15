import { TILE, tileInfo } from '../world/tiles'
import { makeRng } from '../world/rng'

export const TILE_PX = 16
/** variants per terrain type — chosen per-tile by position hash to break repetition */
export const TILE_VARIANTS = 3

export type Tileset = Map<number, HTMLCanvasElement[]>

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = TILE_PX
  c.height = TILE_PX
  return [c, c.getContext('2d')!]
}

/** shade the base color: amount in [-1, 1], negative darkens */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => {
    const s = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount
    return Math.max(0, Math.min(255, Math.round(s)))
  }
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function drawTile(type: number, variant: number): HTMLCanvasElement {
  const [c, g] = makeCanvas()
  const base = tileInfo(type).color
  g.fillStyle = base
  g.fillRect(0, 0, TILE_PX, TILE_PX)
  const rng = makeRng((type * 31 + variant) * 2654435761)
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color
    g.fillRect(x, y, w, h)
  }

  switch (type) {
    case TILE.OCEAN: {
      // gentle two-tone swell; variants shift the wave rows for shimmer cycling
      const light = shade(base, 0.16)
      const dark = shade(base, -0.18)
      for (let i = 0; i < 3; i++) {
        const y = (variant * 2 + i * 5 + Math.floor(rng() * 2)) % TILE_PX
        px(1 + Math.floor(rng() * 3), y, 5, 1, light)
        px(9 + Math.floor(rng() * 3), (y + 3) % TILE_PX, 4, 1, dark)
      }
      break
    }
    case TILE.RIVER: {
      // brighter than the sea, with a flowing center thread
      px(0, 0, TILE_PX, TILE_PX, shade(base, 0.08))
      const light = shade(base, 0.32)
      for (let i = 0; i < 3; i++) {
        const y = (variant * 3 + i * 5) % TILE_PX
        px(2 + Math.floor(rng() * 4), y, 4, 1, light)
      }
      break
    }
    case TILE.BEACH: {
      const dark = shade(base, -0.14)
      const light = shade(base, 0.22)
      for (let i = 0; i < 7; i++) px(Math.floor(rng() * 16), Math.floor(rng() * 16), 1, 1, dark)
      for (let i = 0; i < 4; i++) px(Math.floor(rng() * 16), Math.floor(rng() * 16), 1, 1, light)
      if (variant === 2) px(6, 9, 2, 1, '#c9705a') // a shell
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
      if (variant === 2) px(11, 4, 1, 1, '#e8e07a') // a wildflower
      break
    }
    case TILE.FOREST: {
      // real mini-pines on a grass floor
      px(0, 0, TILE_PX, TILE_PX, shade('#4c9a3a', -0.25))
      const trees = 2 + (variant % 2)
      for (let t = 0; t < trees; t++) {
        const tx = 2 + Math.floor(rng() * 11)
        const ty = 4 + Math.floor(rng() * 8)
        px(tx + 1, ty + 3, 1, 2, '#4a2f18') // trunk
        g.fillStyle = shade(base, t % 2 ? 0.12 : -0.1)
        g.beginPath()
        g.moveTo(tx - 1.5, ty + 3)
        g.lineTo(tx + 1.5, ty - 3)
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
        g.arc(2 + rng() * 12, 2 + rng() * 12, 2.4 + rng() * 1.6, 0, Math.PI * 2)
        g.fill()
      }
      for (let i = 0; i < 4; i++) px(Math.floor(rng() * 16), Math.floor(rng() * 16), 1, 1, light)
      break
    }
    case TILE.DESERT: {
      // dune ridges; a cactus on one variant
      const dark = shade(base, -0.15)
      for (let i = 0; i < 2; i++) {
        const y = 3 + variant * 2 + i * 7
        g.strokeStyle = dark
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(0, y)
        g.quadraticCurveTo(8, y - 3, 16, y)
        g.stroke()
      }
      if (variant === 1) {
        px(11, 6, 1, 5, '#4e7a3a')
        px(9, 8, 2, 1, '#4e7a3a')
        px(12, 7, 2, 1, '#4e7a3a')
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
  return c
}

export function buildTileset(): Tileset {
  const set: Tileset = new Map()
  for (const t of Object.values(TILE)) {
    const variants: HTMLCanvasElement[] = []
    for (let v = 0; v < TILE_VARIANTS; v++) variants.push(drawTile(t as number, v))
    set.set(t as number, variants)
  }
  return set
}
