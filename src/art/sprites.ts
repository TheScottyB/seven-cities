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

/** A villager going about their day — scale is walk-in-scene pixels. */
export function drawVillager(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number): void {
  g.fillStyle = '#7a4a2e'
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

/** A single hut for the walk-in scene. */
export function drawHut(g: CanvasRenderingContext2D, cx: number, cy: number, sz: number): void {
  g.fillStyle = '#5a3a1e'
  g.fillRect(cx - sz * 0.4, cy - sz * 0.05, sz * 0.8, sz * 0.42)
  g.fillStyle = '#7a4a24'
  g.beginPath()
  g.moveTo(cx - sz * 0.48, cy - sz * 0.02)
  g.lineTo(cx, cy - sz * 0.45)
  g.lineTo(cx + sz * 0.48, cy - sz * 0.02)
  g.closePath()
  g.fill()
  g.fillStyle = '#2a1c10'
  g.fillRect(cx - sz * 0.1, cy + sz * 0.12, sz * 0.2, sz * 0.25)
}

/** A mission fort: palisade square, gate, and the expedition banner. */
export function drawFort(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  const s = TILE_PX
  g.fillStyle = '#6a4a2a'
  g.fillRect(cx - s * 0.42, cy - s * 0.3, s * 0.84, s * 0.62)
  g.fillStyle = '#8a6a42'
  for (let i = 0; i < 5; i++) g.fillRect(cx - s * 0.42 + i * s * 0.2, cy - s * 0.38, s * 0.08, s * 0.12)
  g.fillStyle = '#2a1c10'
  g.fillRect(cx - s * 0.1, cy + s * 0.05, s * 0.2, s * 0.27)
  // banner
  g.strokeStyle = '#3a2a18'
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(cx + s * 0.3, cy - s * 0.3)
  g.lineTo(cx + s * 0.3, cy - s * 0.62)
  g.stroke()
  g.fillStyle = '#f4c430'
  g.fillRect(cx + s * 0.3, cy - s * 0.62, s * 0.22, s * 0.14)
}

/** The expedition's caravel: dark hull, white sail, pennant. */
export function drawShip(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  const s = TILE_PX
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
  // sail
  g.fillStyle = '#e8e4d8'
  g.beginPath()
  g.moveTo(cx + s * 0.04, cy - s * 0.42)
  g.lineTo(cx + s * 0.38, cy - s * 0.02)
  g.lineTo(cx + s * 0.04, cy - s * 0.02)
  g.closePath()
  g.fill()
  // pennant
  g.fillStyle = '#b1372f'
  g.fillRect(cx - s * 0.2, cy - s * 0.48, s * 0.16, s * 0.09)
}

/** A village: cluster of huts, gold-roofed if it's one of the fabled cities. */
export function drawVillage(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  golden: boolean,
  discovered: boolean,
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
  if (golden && discovered) {
    g.strokeStyle = '#fff2b0'
    g.lineWidth = 1
    g.strokeRect(cx - s * 0.42, cy - s * 0.36, s * 0.84, s * 0.78)
  }
}
