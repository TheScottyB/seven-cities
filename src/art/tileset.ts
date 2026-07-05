import { TILE, tileInfo } from '../world/tiles'
import { makeRng } from '../world/rng'

export const TILE_PX = 16

/**
 * Build a small pixel-art canvas for one tile type: a flat base colour plus a
 * little deterministic texture so terrain reads at a glance (dotted canopy for
 * forest/jungle, wave lines for water, speckle for desert/beach).
 */
function drawTile(type: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = TILE_PX
  c.height = TILE_PX
  const g = c.getContext('2d')!
  const info = tileInfo(type)
  g.fillStyle = info.color
  g.fillRect(0, 0, TILE_PX, TILE_PX)

  const rng = makeRng(type * 2654435761)
  const shade = (color: string, a: number) => {
    g.fillStyle = color
    g.globalAlpha = a
  }

  switch (type) {
    case TILE.OCEAN:
    case TILE.RIVER: {
      shade('#ffffff', 0.12)
      for (let i = 0; i < 3; i++) {
        const y = Math.floor(rng() * TILE_PX)
        g.fillRect(2, y, 6, 1)
        g.fillRect(9, (y + 4) % TILE_PX, 5, 1)
      }
      break
    }
    case TILE.FOREST:
    case TILE.JUNGLE: {
      shade('#000000', 0.18)
      for (let i = 0; i < 10; i++) g.fillRect(Math.floor(rng() * TILE_PX), Math.floor(rng() * TILE_PX), 2, 2)
      shade('#ffffff', 0.06)
      for (let i = 0; i < 6; i++) g.fillRect(Math.floor(rng() * TILE_PX), Math.floor(rng() * TILE_PX), 1, 1)
      break
    }
    case TILE.GRASS: {
      shade('#000000', 0.1)
      for (let i = 0; i < 6; i++) g.fillRect(Math.floor(rng() * TILE_PX), Math.floor(rng() * TILE_PX), 1, 1)
      break
    }
    case TILE.DESERT:
    case TILE.BEACH: {
      shade('#000000', 0.08)
      for (let i = 0; i < 8; i++) g.fillRect(Math.floor(rng() * TILE_PX), Math.floor(rng() * TILE_PX), 1, 1)
      break
    }
    case TILE.MOUNTAIN:
    case TILE.HIGHLAND: {
      shade('#ffffff', 0.14)
      g.beginPath()
      g.moveTo(2, 13)
      g.lineTo(7, 4)
      g.lineTo(12, 13)
      g.fill()
      shade('#000000', 0.2)
      g.fillRect(0, 14, TILE_PX, 2)
      break
    }
  }
  g.globalAlpha = 1
  return c
}

export function buildTileset(): Map<number, HTMLCanvasElement> {
  const set = new Map<number, HTMLCanvasElement>()
  for (const t of Object.values(TILE)) set.set(t as number, drawTile(t as number))
  return set
}
