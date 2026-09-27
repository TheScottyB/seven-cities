import type { GameState } from '../game/state'

const FONT = "16px 'Courier New', monospace"

/** Compass-style wind arrow shown while sailing (left of the minimap). */
export function drawWindIndicator(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  angle: number,
  strength: number,
  top = 52,
): void {
  const cx = viewW - 170
  const cy = top + 60
  const r = 24
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#5a5a64'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  // arrow points the way the wind blows
  const len = r * (0.45 + 0.55 * strength)
  const hx = cx + Math.cos(angle) * len
  const hy = cy + Math.sin(angle) * len
  ctx.strokeStyle = '#cfe6ff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - Math.cos(angle) * len * 0.6, cy - Math.sin(angle) * len * 0.6)
  ctx.lineTo(hx, hy)
  ctx.stroke()
  ctx.fillStyle = '#cfe6ff'
  ctx.beginPath()
  ctx.moveTo(hx, hy)
  ctx.lineTo(hx - Math.cos(angle - 0.45) * 7, hy - Math.sin(angle - 0.45) * 7)
  ctx.lineTo(hx - Math.cos(angle + 0.45) * 7, hy - Math.sin(angle + 0.45) * 7)
  ctx.closePath()
  ctx.fill()
  ctx.font = "11px 'Courier New', monospace"
  ctx.fillStyle = '#9a9aa6'
  ctx.textAlign = 'center'
  ctx.fillText('WIND', cx, cy + r + 16)
  ctx.textAlign = 'left'
}

/**
 * Draws the status bar, wrapping onto extra rows when the window is narrow
 * instead of clipping. Items that carry no information yet (empty bank,
 * no fear abroad) stay hidden. Returns the bar height so everything anchored
 * beneath it (minimap, wind compass) can shift down.
 */
export function drawHud(ctx: CanvasRenderingContext2D, viewW: number, s: GameState, banked = 0): number {
  ctx.font = FONT
  ctx.textBaseline = 'middle'

  const foodColor = s.food < 80 ? '#c0504d' : s.food < 150 ? '#e0b34f' : '#7fd17f'
  const goodsColor = s.goods < 25 ? '#c0504d' : '#d8925c'
  const items: [string, string, string][] = [
    ['Food', Math.floor(s.food).toString(), foodColor],
    ['Goods', Math.floor(s.goods).toString(), goodsColor],
    ['Crew', Math.floor(s.crew).toString(), '#e0d18a'],
    ['Gold', Math.floor(s.gold).toString(), '#f4c430'],
  ]
  if (banked > 0) items.push(['Bank', Math.floor(banked).toString(), '#c9a94f'])
  items.push(['Morale', Math.floor(s.morale).toString(), '#7fb0ff'])
  if (s.fear >= 1) items.push(['Fear', Math.floor(s.fear).toString(), s.fear > 40 ? '#c0504d' : '#8a8a94'])
  items.push(['Day', s.day.toString(), '#cccccc'])
  items.push(['Cities', `${s.citiesFound}/7`, '#f4c430'])

  // measure and wrap
  const placed: { x: number; row: number; label: string; value: string; color: string; lw: number }[] = []
  let x = 16
  let row = 0
  for (const [label, value, color] of items) {
    const lw = ctx.measureText(label + ': ').width
    const total = lw + ctx.measureText(value).width + 24
    if (x + total > viewW - 8 && x > 16) {
      row++
      x = 16
    }
    placed.push({ x, row, label, value, color, lw })
    x += total
  }

  const height = 40 + row * 24
  // an inked vellum band with a gold rule under it, rather than the
  // translucent black strip of a web app
  ctx.fillStyle = 'rgba(24,19,12,0.88)'
  ctx.fillRect(0, 0, viewW, height)
  ctx.fillStyle = 'rgba(244,196,48,0.45)'
  ctx.fillRect(0, height - 1, viewW, 1)
  for (const it of placed) {
    const y = 20 + it.row * 24
    ctx.fillStyle = '#9a8a6a'
    ctx.fillText(it.label + ':', it.x, y)
    ctx.fillStyle = it.color
    ctx.fillText(it.value, it.x + it.lw, y)
  }
  return height
}
