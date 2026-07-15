import { GameState } from '../game/state'

const FONT = "16px 'Courier New', monospace"

/** Compass-style wind arrow shown while sailing (left of the minimap). */
export function drawWindIndicator(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  angle: number,
  strength: number,
): void {
  const cx = viewW - 170
  const cy = 112
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

export function drawHud(ctx: CanvasRenderingContext2D, viewW: number, s: GameState): void {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, viewW, 40)
  ctx.font = FONT
  ctx.textBaseline = 'middle'

  const items: [string, string, string][] = [
    ['Food', Math.floor(s.food).toString(), '#7fd17f'],
    ['Goods', Math.floor(s.goods).toString(), '#d8925c'],
    ['Crew', Math.floor(s.crew).toString(), '#e0d18a'],
    ['Gold', Math.floor(s.gold).toString(), '#f4c430'],
    ['Morale', Math.floor(s.morale).toString(), '#7fb0ff'],
    ['Fear', Math.floor(s.fear).toString(), s.fear > 40 ? '#c0504d' : '#8a8a94'],
    ['Day', s.day.toString(), '#cccccc'],
    ['Cities', `${s.citiesFound}/7`, '#f4c430'],
  ]

  let x = 16
  for (const [label, value, color] of items) {
    ctx.fillStyle = '#8a8a94'
    ctx.fillText(label + ':', x, 20)
    const lw = ctx.measureText(label + ': ').width
    ctx.fillStyle = color
    ctx.fillText(value, x + lw, 20)
    x += lw + ctx.measureText(value).width + 24
  }
}
