/**
 * The chart the world is drawn on.
 *
 * Unexplored country is not a void — it is the blank vellum the cartographer
 * has not reached yet. But it stays DARK vellum: early on, unexplored ground
 * is most of the frame, and a bright cream field would invert figure and
 * ground, pulling the eye to the absence of information instead of to the
 * coastline the player just charted. Charted land must stay the brightest
 * thing on screen, and gold the brightest accent.
 */
import { TILE_PX } from './tileset'

export const PAPER = '#2a2318'

/** Aged fibres, flecks and faint chain lines — laid paper, seen in shadow. */
function buildPaperTile(): HTMLCanvasElement {
  const S = 64
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = PAPER
  g.fillRect(0, 0, S, S)
  let s = 0x9e3779b9
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  // chain lines: the widely spaced ribs of a laid mould. Very faint — at the
  // scale a whole unexplored map covers, anything stronger rules the void into
  // visible columns.
  g.fillStyle = 'rgba(228,206,164,0.022)'
  for (let x = 5; x < S; x += 21) g.fillRect(x, 0, 1, S)
  // fibres
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rnd() * S)
    const y = Math.floor(rnd() * S)
    g.fillStyle = rnd() < 0.5 ? 'rgba(232,214,176,0.055)' : 'rgba(16,12,8,0.10)'
    if (rnd() < 0.5) g.fillRect(x, y, 1 + Math.floor(rnd() * 2), 1)
    else g.fillRect(x, y, 1, 1 + Math.floor(rnd() * 2))
  }
  // darker flecks — the specks in hand-laid stock
  for (let i = 0; i < 26; i++) {
    g.fillStyle = 'rgba(12,9,6,0.16)'
    g.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 1, 1)
  }
  return c
}

let paperTile: HTMLCanvasElement | null = null
let scaled: { zoom: number; canvas: HTMLCanvasElement } | null = null

/**
 * The paper, pre-scaled to the current zoom and returned as a pattern that can
 * be filled UNSCALED. We do the magnification ourselves with smoothing off
 * rather than trusting a scaled context to honour imageSmoothingEnabled on a
 * pattern — browsers have disagreed about that, and a softened grain would
 * quietly undo the whole pixel-art contract.
 */
export function paperPattern(ctx: CanvasRenderingContext2D, zoom: number): CanvasPattern {
  if (!paperTile) paperTile = buildPaperTile()
  if (!scaled || scaled.zoom !== zoom) {
    const src = paperTile
    const c = document.createElement('canvas')
    c.width = src.width * zoom
    c.height = src.height * zoom
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.drawImage(src, 0, 0, c.width, c.height)
    scaled = { zoom, canvas: c }
  }
  return ctx.createPattern(scaled.canvas, 'repeat')!
}

/**
 * Torn deckle edges for the fog frontier. Keyed by the cardinal mask of sides
 * where unexplored paper lies, two variants each so the boundary is ragged
 * rather than ruled. Position-hashed, never time-varying.
 */
export type DeckleSet = Map<number, HTMLCanvasElement>

function buildDeckle(mask: number, variant: number): HTMLCanvasElement | null {
  const c = document.createElement('canvas')
  c.width = TILE_PX
  c.height = TILE_PX
  const g = c.getContext('2d')!
  const img = g.createImageData(TILE_PX, TILE_PX)
  const n = parseInt(PAPER.slice(1), 16)
  const r = (n >> 16) & 255
  const gg = (n >> 8) & 255
  const b = n & 255
  let s = (mask * 2654435761 + variant * 40503) >>> 0
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  let any = false
  const put = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= TILE_PX || y >= TILE_PX) return
    const o = (y * TILE_PX + x) * 4
    img.data[o] = r
    img.data[o + 1] = gg
    img.data[o + 2] = b
    img.data[o + 3] = 255
    any = true
  }
  // each edge that faces paper gets a ragged 1-3px bite taken out of the land
  for (let k = 0; k < 4; k++) {
    if (!(mask & (1 << k))) continue
    for (let i = 0; i < TILE_PX; i++) {
      const bite = 1 + Math.floor(rnd() * 2.6)
      for (let d = 0; d < bite; d++) {
        if (k === 0) put(i, d)
        else if (k === 1) put(TILE_PX - 1 - d, i)
        else if (k === 2) put(i, TILE_PX - 1 - d)
        else put(d, i)
      }
    }
  }
  if (!any) return null
  g.putImageData(img, 0, 0)
  return c
}

export function buildDeckles(): DeckleSet {
  const set: DeckleSet = new Map()
  for (let mask = 1; mask < 16; mask++) {
    for (let v = 0; v < 2; v++) {
      const c = buildDeckle(mask, v)
      if (c) set.set(mask * 2 + v, c)
    }
  }
  return set
}
