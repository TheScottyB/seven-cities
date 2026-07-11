import { TILE_PX } from './tileset'

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
