import type { Village } from '../world/villages'
import { Outfit, outfitCost, remainingBudget, PRICES, BUDGET } from '../game/outfit'
import { TRADE_GOODS, GIFT_GOODS } from '../game/encounter'

function panel(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, w: number, h: number) {
  const x = (viewW - w) / 2
  const y = (viewH - h) / 2
  ctx.fillStyle = 'rgba(10,12,22,0.94)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#f4c430'
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, w, h)
  return { x, y }
}

function center(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, font: string, color: string) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, cx, y)
  ctx.textAlign = 'left'
}

export function drawOutfitScreen(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  outfit: Outfit,
  selectedRow: number,
): void {
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, viewW, viewH)
  const cx = viewW / 2
  center(ctx, 'OUTFIT YOUR EXPEDITION', cx, viewH / 2 - 150, "bold 32px 'Courier New', monospace", '#f4c430')
  center(
    ctx,
    `The Crown grants you ${BUDGET} gold. Spend it well — what remains sails with you.`,
    cx,
    viewH / 2 - 112,
    "15px 'Courier New', monospace",
    '#9a9aa6',
  )

  const rows: [keyof Outfit, string, string][] = [
    ['food', 'Food', `rations for the crew  (${PRICES.food} gold each)`],
    ['goods', 'Trade goods', `needed to trade & gift  (${PRICES.goods} gold each)`],
    ['crew', 'Crew', `men for the expedition  (${PRICES.crew} gold each)`],
  ]
  let y = viewH / 2 - 52
  ctx.textAlign = 'left'
  const left = cx - 260
  rows.forEach(([key, label, desc], i) => {
    const sel = i === selectedRow
    ctx.font = sel ? "bold 20px 'Courier New', monospace" : "18px 'Courier New', monospace"
    ctx.fillStyle = sel ? '#f4c430' : '#c9c9d2'
    ctx.fillText(`${sel ? '> ' : '  '}${label}`, left, y)
    ctx.fillText(`< ${String(outfit[key]).padStart(3)} >`, left + 260, y)
    ctx.font = "13px 'Courier New', monospace"
    ctx.fillStyle = '#7a7a86'
    ctx.fillText(desc, left + 24, y + 20)
    y += 58
  })

  center(
    ctx,
    `Spent: ${outfitCost(outfit)}    Sails as gold: ${remainingBudget(outfit)}`,
    cx,
    y + 8,
    "17px 'Courier New', monospace",
    '#e0d18a',
  )
  center(ctx, '↑↓ choose   ←→ adjust   ENTER set sail', cx, y + 48, "15px 'Courier New', monospace", '#7fd17f')
}

export function drawStartScreen(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  seed: string,
  hasSave: boolean,
): void {
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, viewW, viewH)
  const cx = viewW / 2
  center(ctx, 'THE SEVEN CITIES OF GOLD', cx, viewH / 2 - 120, "bold 40px 'Courier New', monospace", '#f4c430')
  center(ctx, 'A modern expedition into the New World', cx, viewH / 2 - 82, "18px 'Courier New', monospace", '#c9c9d2')

  const lines = [
    'Chart the unknown coast and interior. Find native villages —',
    'trade with them, win them over with gifts, or raid them for gold.',
    'Manage your food, crew, and morale. Discover all seven',
    'fabled Cities of Gold before your expedition falls apart.',
    '',
    'MOVE  W A S D / arrows      INTERACT  E / Space      CHOOSE  1 2 3',
    '',
    `Seed: ${seed}`,
    '',
    'Press ENTER to outfit a new expedition',
  ]
  if (hasSave) lines.push('Press C to continue your last expedition')
  let y = viewH / 2 - 30
  for (const l of lines) {
    const color = l.startsWith('Press ENTER') ? '#7fd17f' : l.startsWith('Press C') ? '#f4c430' : '#9a9aa6'
    center(ctx, l, cx, y, "16px 'Courier New', monospace", color)
    y += 26
  }
}

export function drawEncounter(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  v: Village,
  goods: number,
): void {
  const { x, y } = panel(ctx, viewW, viewH, 500, 268)
  const cx = viewW / 2
  const title = v.golden ? 'A CITY OF GOLD!' : 'A native village'
  center(ctx, title, cx, y + 44, "bold 26px 'Courier New', monospace", v.golden ? '#f4c430' : '#e0d18a')

  const mood = v.temperament > 0.66 ? 'friendly' : v.temperament > 0.33 ? 'wary' : 'hostile'
  center(
    ctx,
    `They appear ${mood}. (pop. ~${v.population})   Your goods: ${Math.floor(goods)}`,
    cx,
    y + 76,
    "15px 'Courier New', monospace",
    '#9a9aa6',
  )

  const noGoods = goods <= 0
  const opts: [string, string, boolean][] = [
    ['1', `Trade  — goods for gold & food  (uses ${TRADE_GOODS} goods)`, noGoods],
    ['2', `Gift   — earn goodwill & rumors  (uses ${GIFT_GOODS} goods)`, noGoods],
    ['3', 'Attack — seize their gold by force  (risks crew)', false],
  ]
  ctx.textAlign = 'left'
  let ly = y + 122
  for (const [k, label, disabled] of opts) {
    ctx.font = "bold 18px 'Courier New', monospace"
    ctx.fillStyle = disabled ? '#5a5a64' : '#f4c430'
    ctx.fillText(`[${k}]`, x + 36, ly)
    ctx.fillStyle = disabled ? '#5a5a64' : '#d7d7de'
    ctx.font = "15px 'Courier New', monospace"
    ctx.fillText(label + (disabled ? '  — no goods!' : ''), x + 80, ly)
    ly += 34
  }
  center(ctx, 'Esc — walk away', cx, y + 244, "14px 'Courier New', monospace", '#7a7a86')
}

export function drawResult(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, text: string): void {
  const { y } = panel(ctx, viewW, viewH, 460, 90)
  center(ctx, text, viewW / 2, y + 54, "18px 'Courier New', monospace", '#7fd17f')
}

export function drawGameOver(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, won: boolean, score: number): void {
  ctx.fillStyle = 'rgba(6,6,12,0.9)'
  ctx.fillRect(0, 0, viewW, viewH)
  const cx = viewW / 2
  if (won) {
    center(ctx, 'THE SEVEN CITIES ARE YOURS', cx, viewH / 2 - 40, "bold 36px 'Courier New', monospace", '#f4c430')
    center(ctx, 'Glory and gold beyond measure.', cx, viewH / 2, "18px 'Courier New', monospace", '#e0d18a')
  } else {
    center(ctx, 'THE EXPEDITION IS LOST', cx, viewH / 2 - 40, "bold 36px 'Courier New', monospace", '#c0504d')
    center(ctx, 'Your crew will chart no more.', cx, viewH / 2, "18px 'Courier New', monospace", '#c9c9d2')
  }
  center(ctx, `Final score: ${score}`, cx, viewH / 2 + 40, "20px 'Courier New', monospace", '#ffffff')
  center(ctx, 'Press ENTER for a new expedition', cx, viewH / 2 + 84, "16px 'Courier New', monospace", '#7fd17f')
}
