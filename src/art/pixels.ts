/**
 * pixels.ts — pixel-art primitives for the baked sprite bank.
 *
 * Everything here is *authoring* machinery: a char-grid DSL for writing sprites
 * as readable text, plus the three passes that turn a canvas drawing into
 * honest 8-bit pixel art (harden -> outline -> mirror).
 *
 * NOTHING at module scope touches the DOM, so this file is safe to import from
 * a node-environment vitest run. Every canvas is created inside a function.
 */

/** Padded sprite cell. ANCHOR_X === CELL/2 is REQUIRED for the mirror trick. */
export const CELL = 24
export const ANCHOR_X = CELL / 2

/**
 * Outline colour. Deliberately NOT pure black: against the dark-navy ocean a
 * #000 contour reads as a hole punched in the water rather than as ink.
 */
const OUTLINE = '#160f09'

// ---------------------------------------------------------------------------
// pure char-grid helpers (no DOM — unit-testable)
// ---------------------------------------------------------------------------

/** A sprite authored as one character per pixel. '.' and ' ' are transparent. */
export type Grid = readonly string[]

/** Character -> CSS colour. Missing characters are treated as transparent. */
export type Palette = Record<string, string>

/** [width, height] of a char grid, width being the longest row. */
export function gridSize(rows: Grid): [number, number] {
  let w = 0
  for (const r of rows) if (r.length > w) w = r.length
  return [w, rows.length]
}

/**
 * Generate a gait frame by displacing the two legs of an authored figure.
 *
 * Only the rectangle rows >= `legTop`, cols in [colLo, colHi] is touched, so
 * props that reach into the leg rows (the conquistador's grounded pike) stay
 * put. Columns below `midCol` are the near leg, the rest the far leg. Pixels
 * pushed outside the rectangle are dropped — that is what makes a lifted foot
 * read as lifted.
 */
export function shiftLegs(
  rows: Grid,
  legTop: number,
  colLo: number,
  colHi: number,
  midCol: number,
  dxNear: number,
  dyNear: number,
  dxFar: number,
  dyFar: number,
): string[] {
  const [w, h] = gridSize(rows)
  const src = rows.map((r) => r.padEnd(w, '.').split(''))
  const out = src.map((r) => r.slice())
  for (let y = legTop; y < h; y++) {
    for (let x = colLo; x <= colHi && x < w; x++) out[y][x] = '.'
  }
  for (let y = legTop; y < h; y++) {
    for (let x = colLo; x <= colHi && x < w; x++) {
      const ch = src[y][x]
      if (ch === '.' || ch === ' ') continue
      const near = x < midCol
      const tx = x + (near ? dxNear : dxFar)
      const ty = y + (near ? dyNear : dyFar)
      if (ty < legTop || ty >= h) continue
      if (tx < colLo || tx > colHi || tx >= w) continue
      out[ty][tx] = ch
    }
  }
  return out.map((r) => r.join(''))
}

/** Displace whole rows [rowLo, rowHi] horizontally — used for the ship's heel. */
export function shiftRows(rows: Grid, rowLo: number, rowHi: number, dx: number): string[] {
  const [w] = gridSize(rows)
  return rows.map((r, y) => {
    const padded = r.padEnd(w, '.')
    if (y < rowLo || y > rowHi || dx === 0) return padded
    return dx > 0 ? ('.'.repeat(dx) + padded).slice(0, w) : (padded.slice(-dx) + '.'.repeat(-dx))
  })
}

// ---------------------------------------------------------------------------
// canvas primitives (DOM — only ever called from buildSpriteBank())
// ---------------------------------------------------------------------------

/**
 * A blank, smoothing-disabled cell. `readback` marks a scratch canvas that
 * harden()/outlined() will getImageData from; it only takes effect here, on the
 * canvas's first getContext call. Leave it off for cells blitted every frame.
 */
export function makeCell(w = CELL, h = CELL, readback = false): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: readback })!
  g.imageSmoothingEnabled = false
  return c
}

function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  return g
}

/** Paint a char grid at (x, y). One character per pixel. */
function blit(g: CanvasRenderingContext2D, rows: Grid, pal: Palette, x: number, y: number): void {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let c = 0; c < row.length; c++) {
      const col = pal[row[c]]
      if (!col) continue // '.', ' ' and anything unmapped is transparent
      g.fillStyle = col
      g.fillRect(x + c, y + r, 1, 1)
    }
  }
}

/**
 * Alpha-threshold pass, in place. Every pixel becomes fully transparent or
 * fully opaque, which turns antialiased curves into true hard-edged pixel art.
 * Expensive — must NEVER run inside a frame.
 */
function harden(c: HTMLCanvasElement, threshold = 128): void {
  const g = ctxOf(c)
  const img = g.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < threshold ? 0 : 255
  g.putImageData(img, 0, 0)
}

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * 4-NEIGHBOUR CROSS dilation — deliberately not 8-way. An 8-way pass fattens
 * diagonals to a visual 1.4px and yields the thick uniform contour of a modern
 * indie asset pack. The cross breaks on diagonals exactly the way hand-placed
 * 8-bit outlines do. Requires a hardened source: a soft alpha ramp would make
 * the dilation mask fuzzy.
 */
function outlined(src: HTMLCanvasElement, color = OUTLINE): HTMLCanvasElement {
  const w = src.width
  const h = src.height
  const s = ctxOf(src).getImageData(0, 0, w, h).data
  const out = makeCell(w, h)
  const og = ctxOf(out)
  const img = og.createImageData(w, h)
  const d = img.data
  const [r, g, b] = rgbOf(color)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (s[i + 3] !== 0) continue // sprite body — drawn over the outline below
      const hit =
        (x > 0 && s[i - 4 + 3] !== 0) ||
        (x < w - 1 && s[i + 4 + 3] !== 0) ||
        (y > 0 && s[i - w * 4 + 3] !== 0) ||
        (y < h - 1 && s[i + w * 4 + 3] !== 0)
      if (!hit) continue
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      d[i + 3] = 255
    }
  }
  og.putImageData(img, 0, 0)
  og.drawImage(src, 0, 0)
  return out
}

/** THE ONLY PATH INTO THE BANK. Order matters: the dilation mask must be hard. */
function finish(c: HTMLCanvasElement): HTMLCanvasElement {
  harden(c)
  return outlined(c)
}

/** Horizontal flip. Safe because ANCHOR_X === CELL/2. */
export function mirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = makeCell(src.width, src.height)
  const g = ctxOf(out)
  g.translate(src.width, 0)
  g.scale(-1, 1)
  g.drawImage(src, 0, 0)
  return out
}

/**
 * A hardened, re-tinted contact shadow in its own cell.
 *
 * harden() forces alpha to 255, so translucency has to be restored afterwards
 * with a 'source-in' fill. Below radius 3 a hard ellipse is a shapeless blob,
 * so a plain 4x1 bar is used instead.
 */
export function shadowCell(cx: number, cy: number, radius: number, alpha = 0.3): HTMLCanvasElement {
  const c = makeCell(CELL, CELL, true)
  const g = ctxOf(c)
  g.fillStyle = '#000'
  if (radius < 3) {
    g.fillRect(Math.round(cx) - 2, Math.round(cy), 4, 1)
  } else {
    g.beginPath()
    g.ellipse(cx, cy, radius, Math.max(1.5, radius * 0.38), 0, 0, Math.PI * 2)
    g.fill()
  }
  harden(c)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = `rgba(0,0,0,${alpha})`
  g.fillRect(0, 0, c.width, c.height)
  g.globalCompositeOperation = 'source-over'
  return c
}

/**
 * Compose one bank cell: authored art -> harden -> 4-way outline, laid over a
 * baked contact shadow. The shadow is composited *after* outlining so it never
 * gets a contour of its own.
 */
export function bakeCell(art: HTMLCanvasElement, shadow: HTMLCanvasElement | null): HTMLCanvasElement {
  const body = finish(art)
  if (!shadow) return body
  const out = makeCell(body.width, body.height)
  const g = ctxOf(out)
  g.drawImage(shadow, 0, 0)
  g.drawImage(body, 0, 0)
  return out
}

/** Draw a char grid into a fresh cell at (x, y) without any post-processing. */
export function cellFrom(rows: Grid, pal: Palette, x: number, y: number): HTMLCanvasElement {
  const c = makeCell(CELL, CELL, true)
  blit(ctxOf(c), rows, pal, x, y)
  return c
}
