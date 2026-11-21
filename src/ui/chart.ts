/**
 * Full-screen Cartographer's World Chart (`Tab` or clicking the corner minimap).
 * Displays the entire 192x192 charted New World on vellum with Cities of Gold,
 * villages, discovered landmarks, mission forts, moored caravels, and explorer.
 */
import type { GameMap } from '../world/mapgen'
import { isSeen, type Fog } from '../world/fog'
import { CITIES_OF_GOLD, type Village } from '../world/villages'
import type { Explorer } from '../game/explorer'
import type { Outpost } from '../game/outposts'
import type { Landmark } from '../game/discoveries'
import type { Relief } from '../art/relief'
import { miniColor } from '../engine/renderer'
import { addHit, hovered } from './hit'
import { font, fitFont } from './font'

let chartCache: { canvas: HTMLCanvasElement; revealed: number; seed: number } | null = null

function buildChartCanvas(map: GameMap, fog: Fog, relief: Relief): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = map.width
  c.height = map.height
  const g = c.getContext('2d')!
  g.fillStyle = '#221c13'
  g.fillRect(0, 0, map.width, map.height)
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!isSeen(fog, x, y)) continue
      const i = y * map.width + x
      g.fillStyle = miniColor(map.tiles[i], relief.depth[i], relief.hill[i])
      g.fillRect(x, y, 1, 1)
    }
  }
  return c
}

export function invalidateChart(): void {
  chartCache = null
}

export function drawWorldChart(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  map: GameMap,
  fog: Fog,
  explorer: Explorer,
  villages: readonly Village[],
  ships: readonly { x: number; y: number }[],
  outposts: readonly Outpost[],
  landmarks: readonly Landmark[],
  discovered: ReadonlySet<number>,
  relief: Relief,
  citiesFound: number,
): void {
  ctx.fillStyle = 'rgba(8,10,18,0.92)'
  ctx.fillRect(0, 0, viewW, viewH)

  const headerH = 52
  const footerH = 66
  const size = Math.max(160, Math.min(viewW - 48, viewH - headerH - footerH - 16, 620))
  const px = Math.round((viewW - size) / 2)
  const py = Math.round(headerH + (viewH - headerH - footerH - size) / 2)
  const scale = size / map.width

  // title
  ctx.fillStyle = '#f4c430'
  ctx.font = fitFont(ctx, "CARTOGRAPHER'S WORLD CHART", 22, viewW - 48)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText("CARTOGRAPHER'S WORLD CHART", viewW / 2, py - 14)

  // parchment backing + gold border
  ctx.fillStyle = '#221c13'
  ctx.fillRect(px - 3, py - 3, size + 6, size + 6)

  if (typeof document !== 'undefined') {
    if (!chartCache || chartCache.seed !== map.seed || chartCache.revealed !== fog.revealedCount) {
      chartCache = { canvas: buildChartCanvas(map, fog, relief), revealed: fog.revealedCount, seed: map.seed }
    }
    const prevSmooth = ctx.imageSmoothingEnabled
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(chartCache.canvas, px, py, size, size)
    ctx.imageSmoothingEnabled = prevSmooth
  }

  ctx.strokeStyle = '#f4c430'
  ctx.lineWidth = 2
  ctx.strokeRect(px - 3, py - 3, size + 6, size + 6)

  // villages & Cities of Gold
  for (const v of villages) {
    if (!isSeen(fog, v.x, v.y)) continue
    const vx = px + (v.x + 0.5) * scale
    const vy = py + (v.y + 0.5) * scale
    const r = v.golden ? 4 : 2.5
    ctx.fillStyle = v.golden ? '#f4c430' : v.depleted ? '#6a5138' : '#c88c48'
    ctx.fillRect(vx - r, vy - r, r * 2, r * 2)
  }

  // mission forts
  ctx.fillStyle = '#e8d8a0'
  for (const o of outposts) {
    const ox = px + (o.x + 0.5) * scale
    const oy = py + (o.y + 0.5) * scale
    ctx.fillRect(ox - 3, oy - 3, 6, 6)
  }

  // moored ships
  ctx.fillStyle = '#9fd4ff'
  for (const sh of ships) {
    const sx = px + sh.x * scale
    const sy = py + sh.y * scale
    ctx.beginPath()
    ctx.arc(sx, sy, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // discovered landmarks (cyan diamonds + readable ink labels)
  ctx.font = font(11)
  ctx.textBaseline = 'middle'
  for (const lm of landmarks) {
    if (!discovered.has(lm.id)) continue
    const lx = px + (lm.x + 0.5) * scale
    const ly = py + (lm.y + 0.5) * scale
    ctx.fillStyle = '#7fe0e0'
    ctx.beginPath()
    ctx.moveTo(lx, ly - 4)
    ctx.lineTo(lx + 4, ly)
    ctx.lineTo(lx, ly + 4)
    ctx.lineTo(lx - 4, ly)
    ctx.closePath()
    ctx.fill()
    // clamp label inside the chart frame
    const tw = ctx.measureText(lm.name).width
    const labelX = Math.max(px + 6 + tw / 2, Math.min(px + size - 6 - tw / 2, lx))
    const labelY = ly - 10 < py + 10 ? ly + 11 : ly - 10
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(10,12,20,0.85)'
    ctx.fillRect(labelX - tw / 2 - 3, labelY - 7, tw + 6, 14)
    ctx.fillStyle = '#bfecec'
    ctx.fillText(lm.name, labelX, labelY)
  }

  // explorer
  const ex = px + explorer.x * scale
  const ey = py + explorer.y * scale
  ctx.fillStyle = '#ff4d4d'
  ctx.beginPath()
  ctx.arc(ex, ey, 4.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // legend + close line
  const pct = Math.round((fog.revealedCount / (map.width * map.height)) * 100)
  const stats = `Charted ${pct}%  ·  Cities ${citiesFound}/${CITIES_OF_GOLD}  ·  Landmarks ${discovered.size}/${landmarks.length}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = font(14)
  ctx.fillStyle = '#e0d18a'
  ctx.fillText(stats, viewW / 2, py + size + 24, viewW - 32)

  const legend = '■ Gold City   ■ Village   ◆ Landmark   ■ Fort   ● Ship   ● You'
  ctx.font = font(12)
  ctx.fillStyle = '#9a9aa6'
  ctx.fillText(legend, viewW / 2, py + size + 42, viewW - 32)

  const close = 'Tab / Esc — close chart'
  ctx.font = font(14)
  ctx.fillStyle = hovered('chart-close') ? '#a8f0a8' : '#7fd17f'
  ctx.fillText(close, viewW / 2, py + size + 62)
  const cw = ctx.measureText(close).width + 24
  addHit('chart-close', viewW / 2 - cw / 2, py + size + 44, cw, 26)
  ctx.textAlign = 'left'
}
