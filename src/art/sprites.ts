import { TILE_PX } from './tileset'

/** Soft elliptical drop shadow that grounds a sprite on the terrain. */
export function drawShadow(g: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  g.save()
  g.fillStyle = 'rgba(0,0,0,0.3)'
  g.beginPath()
  g.ellipse(cx, cy, radius, radius * 0.38, 0, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

/** The conquistador: a little figure with a helmet and cape. */
export function drawExplorer(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  const s = TILE_PX
  // cape
  g.fillStyle = '#b1372f'
  g.fillRect(cx - s * 0.28, cy - s * 0.15, s * 0.56, s * 0.5)
  // body
  g.fillStyle = '#c9c9d2'
  g.fillRect(cx - s * 0.2, cy - s * 0.1, s * 0.4, s * 0.42)
  // head
  g.fillStyle = '#e3c1a0'
  g.beginPath()
  g.arc(cx, cy - s * 0.24, s * 0.18, 0, Math.PI * 2)
  g.fill()
  // helmet
  g.fillStyle = '#8a8a94'
  g.fillRect(cx - s * 0.2, cy - s * 0.42, s * 0.4, s * 0.14)
}

/** A dugout canoe with a paddler — how the expedition travels rivers. */
export function drawCanoe(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  const s = TILE_PX
  // hull: a slim pointed dugout
  g.fillStyle = '#7a4a24'
  g.beginPath()
  g.moveTo(cx - s * 0.5, cy + s * 0.12)
  g.quadraticCurveTo(cx, cy + s * 0.4, cx + s * 0.5, cy + s * 0.12)
  g.quadraticCurveTo(cx, cy + s * 0.22, cx - s * 0.5, cy + s * 0.12)
  g.fill()
  // paddler
  g.fillStyle = '#e3c1a0'
  g.beginPath()
  g.arc(cx, cy - s * 0.12, s * 0.14, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#b1372f'
  g.fillRect(cx - s * 0.12, cy - s * 0.02, s * 0.24, s * 0.18)
  // paddle
  g.strokeStyle = '#5a3a22'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(cx - s * 0.3, cy + s * 0.28)
  g.lineTo(cx + s * 0.3, cy - s * 0.18)
  g.stroke()
}

/** what the villagers wear: undyed hide, ochre, indigo, madder red, walnut */
const VILLAGER_GARB = ['#7a4a2e', '#9a6a2e', '#3a5a7a', '#8a3a32', '#5a4a30']

/** A villager going about their day — `variant` picks their clothing. */
export function drawVillager(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number, variant = 0): void {
  g.fillStyle = VILLAGER_GARB[((variant % VILLAGER_GARB.length) + VILLAGER_GARB.length) % VILLAGER_GARB.length]
  g.fillRect(cx - sz * 0.14, cy - sz * 0.1, sz * 0.28, sz * 0.34)
  g.fillStyle = '#c88a5a'
  g.beginPath()
  g.arc(cx, cy - sz * 0.2, sz * 0.13, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#1c1410'
  g.fillRect(cx - sz * 0.13, cy - sz * 0.32, sz * 0.26, sz * 0.09)
}

/** The chief: taller, feathered headdress, gold collar. */
export function drawChief(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number): void {
  g.fillStyle = '#8a3a2a'
  g.fillRect(cx - sz * 0.18, cy - sz * 0.12, sz * 0.36, sz * 0.42)
  g.fillStyle = '#f4c430'
  g.fillRect(cx - sz * 0.18, cy - sz * 0.12, sz * 0.36, sz * 0.07)
  g.fillStyle = '#c88a5a'
  g.beginPath()
  g.arc(cx, cy - sz * 0.26, sz * 0.15, 0, Math.PI * 2)
  g.fill()
  // headdress feathers
  for (const [ox, oy, col] of [[-0.2, -0.42, '#c0504d'], [0, -0.5, '#e8e4d8'], [0.2, -0.42, '#3a7ac0']] as const) {
    g.fillStyle = col
    g.beginPath()
    g.ellipse(cx + sz * ox, cy + sz * oy, sz * 0.05, sz * 0.14, ox * 0.8, 0, Math.PI * 2)
    g.fill()
  }
}

/** A single hut for the walk-in scene; a City of Gold gilds its roof. */
export function drawHut(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number, roof = '#7a4a24'): void {
  g.fillStyle = '#5a3a1e'
  g.fillRect(cx - sz * 0.4, cy - sz * 0.05, sz * 0.8, sz * 0.42)
  g.fillStyle = roof
  g.beginPath()
  g.moveTo(cx - sz * 0.48, cy - sz * 0.02)
  g.lineTo(cx, cy - sz * 0.45)
  g.lineTo(cx + sz * 0.48, cy - sz * 0.02)
  g.closePath()
  g.fill()
  // thatch/shingle lines along the roof pitch
  g.strokeStyle = 'rgba(20,12,6,0.25)'
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(cx - sz * 0.3, cy - sz * 0.13)
  g.lineTo(cx + sz * 0.3, cy - sz * 0.13)
  g.moveTo(cx - sz * 0.17, cy - sz * 0.27)
  g.lineTo(cx + sz * 0.17, cy - sz * 0.27)
  g.stroke()
  g.fillStyle = '#2a1c10'
  g.fillRect(cx - sz * 0.1, cy + sz * 0.12, sz * 0.2, sz * 0.25)
}

/** The plaza hearth: stone ring, flickering flame, a thread of smoke. */
export function drawFire(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number, t: number): void {
  g.fillStyle = '#3a2418'
  g.beginPath()
  g.ellipse(cx, cy + sz * 0.06, sz * 0.26, sz * 0.12, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#6a6a72'
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    g.fillRect(cx + Math.cos(a) * sz * 0.3 - 1, cy + sz * 0.05 + Math.sin(a) * sz * 0.15 - 1, 3, 3)
  }
  // three flame licks, each flickering to its own pulse
  const licks: [number, string][] = [[-0.1, '#c05018'], [0.08, '#e8a030'], [0, '#f4c430']]
  licks.forEach(([ox, col], i) => {
    const hgt = sz * (0.26 + 0.1 * Math.sin(t * 9 + i * 2.1))
    const wob = Math.sin(t * 7 + i * 1.3) * sz * 0.04
    g.fillStyle = col
    g.beginPath()
    g.moveTo(cx + ox * sz - sz * 0.08, cy + sz * 0.04)
    g.lineTo(cx + ox * sz + wob, cy + sz * 0.04 - hgt)
    g.lineTo(cx + ox * sz + sz * 0.08, cy + sz * 0.04)
    g.closePath()
    g.fill()
  })
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.7 + k * 0.33) % 1
    g.fillStyle = `rgba(200,200,208,${0.4 * (1 - ph)})`
    g.fillRect(cx + Math.sin(ph * 7 + k) * sz * 0.1, cy - sz * (0.3 + ph * 0.9), 2, 2)
  }
}

/** Clay pots stacked beside a doorway. */
export function drawPots(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number): void {
  for (const [ox, s] of [[-0.12, 0.16], [0.1, 0.12]] as const) {
    g.fillStyle = '#a05a32'
    g.beginPath()
    g.ellipse(cx + ox * sz, cy, sz * s, sz * s * 1.1, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#4a2414'
    g.beginPath()
    g.ellipse(cx + ox * sz, cy - sz * s * 0.9, sz * s * 0.55, sz * s * 0.28, 0, 0, Math.PI * 2)
    g.fill()
  }
}

/** A drying rack hung with the day's catch. */
export function drawRack(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number): void {
  g.strokeStyle = '#5a3a1e'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(cx - sz * 0.3, cy + sz * 0.18)
  g.lineTo(cx - sz * 0.3, cy - sz * 0.22)
  g.moveTo(cx + sz * 0.3, cy + sz * 0.18)
  g.lineTo(cx + sz * 0.3, cy - sz * 0.22)
  g.moveTo(cx - sz * 0.34, cy - sz * 0.2)
  g.lineTo(cx + sz * 0.34, cy - sz * 0.2)
  g.stroke()
  g.fillStyle = '#b07850'
  for (const ox of [-0.18, -0.02, 0.14]) g.fillRect(cx + ox * sz, cy - sz * 0.18, sz * 0.07, sz * 0.22)
}

/** A patch of maize, tassels catching the light. */
export function drawCrop(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number): void {
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const x = cx + (c - 1) * sz * 0.28 + (r % 2) * sz * 0.09
      const y = cy + (r - 0.5) * sz * 0.3
      g.strokeStyle = '#4e7a3a'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(x, y + sz * 0.14)
      g.lineTo(x, y - sz * 0.2)
      g.moveTo(x, y - sz * 0.02)
      g.lineTo(x - sz * 0.09, y - sz * 0.1)
      g.moveTo(x, y + 1 - sz * 0.06)
      g.lineTo(x + sz * 0.09, y - sz * 0.14)
      g.stroke()
      g.fillStyle = '#e8d060'
      g.fillRect(x - 1, y - sz * 0.26, 2, sz * 0.08)
    }
  }
}

/** The golden idol beside the chief of a City of Gold. */
export function drawIdol(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number, t: number): void {
  const gleam = 0.2 + 0.08 * Math.sin(t * 2.4)
  g.fillStyle = `rgba(244,196,48,${gleam})`
  g.beginPath()
  g.ellipse(cx, cy + sz * 0.08, sz * 0.34, sz * 0.16, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#8a6a20'
  g.fillRect(cx - sz * 0.14, cy + sz * 0.04, sz * 0.28, sz * 0.08) // plinth
  g.fillStyle = '#f4c430'
  g.fillRect(cx - sz * 0.09, cy - sz * 0.22, sz * 0.18, sz * 0.26) // figure
  g.beginPath()
  g.arc(cx, cy - sz * 0.28, sz * 0.08, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#fff2b0'
  g.fillRect(cx - 1, cy - sz * 0.34, 2, 2) // the highlight that catches every eye
}

/** A mission fort: palisade square, gate, and the expedition banner. `t` sways the banner. */
export function drawFort(g: CanvasRenderingContext2D, cx: number, cy: number, t = -1): void {
  const s = TILE_PX
  g.fillStyle = '#6a4a2a'
  g.fillRect(cx - s * 0.42, cy - s * 0.3, s * 0.84, s * 0.62)
  g.fillStyle = '#8a6a42'
  for (let i = 0; i < 5; i++) g.fillRect(cx - s * 0.42 + i * s * 0.2, cy - s * 0.38, s * 0.08, s * 0.12)
  g.fillStyle = '#2a1c10'
  g.fillRect(cx - s * 0.1, cy + s * 0.05, s * 0.2, s * 0.27)
  g.fillStyle = '#ffc460' // the garrison keeps a lamp burning
  g.fillRect(cx - s * 0.3, cy - s * 0.1, 2, 2)
  // banner, rippling in the wind when animated
  const flut = t >= 0 ? Math.sin(t * 6) : 0
  g.strokeStyle = '#3a2a18'
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(cx + s * 0.3, cy - s * 0.3)
  g.lineTo(cx + s * 0.3, cy - s * 0.62)
  g.stroke()
  g.fillStyle = '#f4c430'
  g.fillRect(cx + s * 0.3, cy - s * 0.62, s * (0.22 - 0.05 * flut), s * 0.14)
}

/** The expedition's caravel: dark hull, white sail, pennant. `t` bobs it on the swell. */
export function drawShip(g: CanvasRenderingContext2D, cx: number, cy: number, t = -1): void {
  const s = TILE_PX
  if (t >= 0) cy += Math.sin(t * 2.2 + cx * 0.05) * s * 0.05 // ride the swell
  const flut = t >= 0 ? Math.sin(t * 7 + cx * 0.11) : 0
  // hull
  g.fillStyle = '#5a3a22'
  g.beginPath()
  g.moveTo(cx - s * 0.45, cy + s * 0.05)
  g.lineTo(cx + s * 0.45, cy + s * 0.05)
  g.lineTo(cx + s * 0.28, cy + s * 0.35)
  g.lineTo(cx - s * 0.28, cy + s * 0.35)
  g.closePath()
  g.fill()
  // mast
  g.fillStyle = '#3a2a18'
  g.fillRect(cx - s * 0.04, cy - s * 0.45, s * 0.08, s * 0.5)
  // sail, bellying slightly with the wind
  g.fillStyle = '#e8e4d8'
  g.beginPath()
  g.moveTo(cx + s * 0.04, cy - s * 0.42)
  g.lineTo(cx + s * (0.38 + 0.04 * flut), cy - s * 0.02)
  g.lineTo(cx + s * 0.04, cy - s * 0.02)
  g.closePath()
  g.fill()
  // pennant
  g.fillStyle = '#b1372f'
  g.fillRect(cx - s * 0.2, cy - s * 0.48, s * (0.16 - 0.04 * flut), s * 0.09)
}

/** A village: cluster of huts, gold-roofed if it's one of the fabled cities. `t` animates hearth smoke. */
export function drawVillage(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  golden: boolean,
  discovered: boolean,
  t = -1,
): void {
  const s = TILE_PX
  const roof = golden ? '#f4c430' : '#7a4a24'
  g.fillStyle = '#5a3a1e'
  g.fillRect(cx - s * 0.35, cy - s * 0.05, s * 0.7, s * 0.4)
  g.fillStyle = roof
  // three little roof triangles
  for (const ox of [-0.28, 0, 0.28]) {
    g.beginPath()
    g.moveTo(cx + ox * s - s * 0.16, cy)
    g.lineTo(cx + ox * s, cy - s * 0.28)
    g.lineTo(cx + ox * s + s * 0.16, cy)
    g.fill()
  }
  // hearthlight in the doorways — you spot a settlement before you can
  // resolve its roofs. Drawn as hard pixels on the tile grid: no gradient,
  // no bloom, nothing that would veil the terrain a player must read.
  g.fillStyle = golden ? '#ffe27a' : '#ffc460'
  for (const ox of [-0.28, 0.28]) g.fillRect(cx + ox * s - 1, cy + s * 0.06, 2, 2)
  if (golden) {
    g.fillRect(cx - 1, cy + s * 0.06, 2, 2)
    if (discovered) {
      // a charted City of Gold burns as a beacon: stepped rings of flat
      // colour, quantized to half-tiles so they never crawl against the grid
      const pulse = t >= 0 ? 0.5 + 0.5 * Math.sin(t * 1.6) : 1
      // stepped as a diamond, not a square — three stacked bars per ring, so
      // the light reads as radiating rather than as a box laid over the map
      const rings: [number, number][] = [
        [s * 0.8, 0.15],
        [s * 1.2, 0.08],
      ]
      for (const [r, a] of rings) {
        g.fillStyle = `rgba(244,196,48,${(a * (0.65 + 0.35 * pulse)).toFixed(3)})`
        const cy0 = Math.round(cy - r * 0.55)
        const band = Math.max(1, Math.round(r * 0.37))
        for (let k = 0; k < 3; k++) {
          const w = Math.round(r * 2 * (k === 1 ? 1 : 0.58))
          g.fillRect(Math.round(cx - w / 2), cy0 + k * band, w, band)
        }
      }
      // the four-point star that makes it look struck rather than rendered
      g.fillStyle = '#fff2b0'
      const arm = Math.round(s * 0.5 * (0.7 + 0.3 * pulse))
      g.fillRect(Math.round(cx - arm), Math.round(cy - s * 0.1), arm * 2, 1)
      g.fillRect(Math.round(cx), Math.round(cy - s * 0.1) - arm, 1, arm * 2)
    }
  }
  // hearth smoke drifting up from the middle roof
  if (t >= 0) {
    const cycle = 5
    for (let i = 0; i < 2; i++) {
      const ph = ((t * 1.4 + i * cycle * 0.5) % cycle) / cycle // 0 at the roof, 1 dispersed
      const rise = ph * s * 0.55
      g.fillStyle = `rgba(200,200,208,${0.5 * (1 - ph)})`
      g.fillRect(cx + Math.sin(ph * 6 + cx) * s * 0.06, cy - s * 0.3 - rise, 1, 1)
    }
  }
}
