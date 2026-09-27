/**
 * Dithered terrain fringes — the thing that stops the world reading as a grid
 * of coloured squares.
 *
 * Where two land terrains meet, the higher-ranked one dissolves into the lower
 * across a few pixels of ordered (Bayer) dither. That checkerboard fringe is
 * the exact vocabulary 8-bit artists used to blend two colours out of a fixed
 * palette, so it belongs here in a way a soft alpha gradient never would.
 *
 * At most 90 overlays (6 terrains x 15 masks) are baked once at boot; the
 * draw loop does at most one extra drawImage on the ~30% of tiles that sit
 * on a border.
 */
import { TILE, tileInfo } from '../world/tiles'
import { TILE_PX } from './tileset'

/**
 * How far the fringe eats into a tile. Three pixels of a sixteen-pixel tile —
 * the centre 8x8 always stays pure, which is the guarantee that a player can
 * still name a tile at a glance.
 */
const FEATHER = 3

/**
 * Who dissolves into whom. Ranks must be STRICTLY UNIQUE: if two terrains
 * share a rank their shared border never blends, and highland rings every
 * mountain on this map.
 *
 * Ocean, river and mountain are absent on purpose. The waterline belongs to
 * the foam, and mountains are chart symbols that must stay hard-edged.
 */
const RANK: Record<number, number> = {
  [TILE.BEACH]: 1,
  [TILE.DESERT]: 2,
  [TILE.GRASS]: 3,
  [TILE.HIGHLAND]: 4,
  [TILE.FOREST]: 5,
  [TILE.JUNGLE]: 6,
}

/** The terrains that take part in blending, in rank order. */
export const BLENDABLE = Object.keys(RANK).map(Number)

/** 4x4 ordered dither: classic, and it tiles seamlessly across tile borders. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

/**
 * Baked fringe overlays, keyed by `other * 16 + mask` where `mask` is the
 * cardinal-neighbour bitfield (1=N, 2=E, 4=S, 8=W) of sides where `other`
 * lies. Each overlay paints `other`'s colour INTO this tile, thinning out as
 * it goes, so the two terrains interlock like torn paper.
 */
export type EdgeSet = Map<number, HTMLCanvasElement>

function buildOverlay(other: number, mask: number): HTMLCanvasElement | null {
  const c = document.createElement('canvas')
  c.width = TILE_PX
  c.height = TILE_PX
  const g = c.getContext('2d')!
  const img = g.createImageData(TILE_PX, TILE_PX)
  const hex = tileInfo(other).color
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const gg = (n >> 8) & 255
  const b = n & 255
  let any = false

  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      // depth into the tile from whichever blended edges are present
      let depth = 0
      if (mask & 1) depth = Math.max(depth, FEATHER - y)
      if (mask & 4) depth = Math.max(depth, FEATHER - (TILE_PX - 1 - y))
      if (mask & 8) depth = Math.max(depth, FEATHER - x)
      if (mask & 2) depth = Math.max(depth, FEATHER - (TILE_PX - 1 - x))
      if (depth <= 0) continue
      // Never fully solid, even at the outermost row. A 100% edge row reads as
      // a checkered ribbon laid along the border rather than as two terrains
      // interlocking — the fringe should suggest the boundary, not draw it.
      const threshold = (depth / (FEATHER + 2)) * 16
      if (BAYER[y & 3][x & 3] >= threshold) continue
      const o = (y * TILE_PX + x) * 4
      img.data[o] = r
      img.data[o + 1] = gg
      img.data[o + 2] = b
      img.data[o + 3] = 255
      any = true
    }
  }
  if (!any) return null
  g.putImageData(img, 0, 0)
  return c
}

export function buildEdges(): EdgeSet {
  const set: EdgeSet = new Map()
  for (const other of BLENDABLE) {
    for (let mask = 1; mask < 16; mask++) {
      const c = buildOverlay(other, mask)
      if (c) set.set(other * 16 + mask, c)
    }
  }
  return set
}

/**
 * For every tile, which neighbouring terrain bleeds into it and from which
 * sides — packed as `other * 16 + mask`, or 0 for tiles with no blended edge.
 * Computed once per world; the draw loop just reads it.
 *
 * A tile only accepts the bleed of a STRICTLY higher-ranked neighbour, so each
 * boundary is drawn exactly once, from the lower side.
 */
export function buildEdgeKeys(tiles: Uint8Array, w: number, h: number): Uint16Array {
  const out = new Uint16Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const t = tiles[i]
      const rank = RANK[t]
      if (rank === undefined) continue
      let best = -1
      let bestRank = rank
      let mask = 0
      // N, E, S, W
      const nb = [
        y > 0 ? tiles[i - w] : -1,
        x < w - 1 ? tiles[i + 1] : -1,
        y < h - 1 ? tiles[i + w] : -1,
        x > 0 ? tiles[i - 1] : -1,
      ]
      for (let k = 0; k < 4; k++) {
        const o = nb[k]
        if (o < 0) continue
        const r = RANK[o]
        if (r === undefined || r <= bestRank) continue
        // a new, higher-ranked contender takes over the whole fringe
        best = o
        bestRank = r
        mask = 1 << k
      }
      if (best < 0) continue
      // collect every side that same terrain touches
      for (let k = 0; k < 4; k++) if (nb[k] === best) mask |= 1 << k
      out[i] = best * 16 + mask
    }
  }
  return out
}
