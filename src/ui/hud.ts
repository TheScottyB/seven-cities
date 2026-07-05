import { GameState } from '../game/state'

const FONT = "16px 'Courier New', monospace"

export function drawHud(ctx: CanvasRenderingContext2D, viewW: number, s: GameState): void {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, viewW, 40)
  ctx.font = FONT
  ctx.textBaseline = 'middle'

  const items: [string, string, string][] = [
    ['Food', Math.floor(s.food).toString(), '#7fd17f'],
    ['Crew', Math.floor(s.crew).toString(), '#e0d18a'],
    ['Gold', Math.floor(s.gold).toString(), '#f4c430'],
    ['Morale', Math.floor(s.morale).toString(), '#7fb0ff'],
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
