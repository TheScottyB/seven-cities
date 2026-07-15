import type { Village } from '../world/villages'
import { Outfit, outfitCost, remainingBudget, PRICES, BUDGET } from '../game/outfit'
import { TRADE_GOODS, GIFT_GOODS, effectiveTemperament } from '../game/encounter'
import { bestScore, type ChronicleEntry } from '../game/chronicle'
import { rankTitle, rankIndex, budgetFor, RANKS, type Career } from '../game/career'
import { dailyAppetite, type GameState } from '../game/state'

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
  budget = BUDGET,
): void {
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, viewW, viewH)
  const cx = viewW / 2
  center(ctx, 'OUTFIT YOUR EXPEDITION', cx, viewH / 2 - 150, "bold 32px 'Courier New', monospace", '#f4c430')
  center(
    ctx,
    `The Crown grants you ${budget} gold. Spend it well — what remains sails with you.`,
    cx,
    viewH / 2 - 112,
    "15px 'Courier New', monospace",
    '#9a9aa6',
  )

  const rows: [keyof Outfit, string, string][] = [
    ['food', 'Food', `rations for the crew  (${PRICES.food} gold each)`],
    ['goods', 'Trade goods', `needed to trade & gift  (${PRICES.goods} gold each)`],
    ['crew', 'Crew', `men for the expedition  (${PRICES.crew} gold each)`],
    ['ships', 'Ships', `caravels in your fleet  (${PRICES.ships} gold each)`],
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
    `Spent: ${outfitCost(outfit)}    Sails as gold: ${remainingBudget(outfit, budget)}`,
    cx,
    y + 8,
    "17px 'Courier New', monospace",
    '#e0d18a',
  )
  const perDay = dailyAppetite(outfit.crew)
  const days = perDay > 0 ? outfit.food / perDay : 0
  center(
    ctx,
    `A crew of ${outfit.crew} eats ~${Math.round(perDay)} provisions a day — this larder lasts ~${days.toFixed(1)} days`,
    cx,
    y + 34,
    "14px 'Courier New', monospace",
    days < 5 ? '#c0504d' : '#7a9a7a',
  )
  center(ctx, '↑↓ choose   ←→ adjust   ENTER set sail', cx, y + 62, "15px 'Courier New', monospace", '#7fd17f')
}

export function drawStartScreen(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  seed: string,
  hasSave: boolean,
  chronicle: ChronicleEntry[] = [],
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
    'FORT  F      SOUND  M      MENU  Esc',
    '',
    `Seed: ${seed}   (R rolls a new world)`,
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

  // the Chronicle: past expeditions, newest first
  if (chronicle.length) {
    y += 18
    const best = bestScore(chronicle)
    center(ctx, `— CHRONICLE OF EXPEDITIONS · best score ${best} —`, cx, y, "bold 15px 'Courier New', monospace", '#f4c430')
    y += 24
    for (const e of chronicle.slice(0, 4)) {
      const verdict = e.won ? ' WON' : 'LOST'
      const line = `${verdict}   score ${String(e.score).padStart(5)}   ${String(e.gold).padStart(4)} gold   ${e.cities}/7 cities   day ${e.day}`
      center(ctx, line, cx, y, "14px 'Courier New', monospace", e.won ? '#e0d18a' : '#8a8a94')
      y += 21
    }
  }
}

export function drawSpainScreen(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  career: Career,
  state: GameState,
  justBanked: number,
  promoted: boolean,
): void {
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, viewW, viewH)
  const cx = viewW / 2
  const title = rankTitle(career.banked)
  center(ctx, 'SPAIN — THE COURT OF THE CROWN', cx, viewH / 2 - 150, "bold 32px 'Courier New', monospace", '#f4c430')
  center(
    ctx,
    `Voyage ${career.voyages} complete. You banked ${justBanked} gold with the Crown.`,
    cx,
    viewH / 2 - 108,
    "16px 'Courier New', monospace",
    '#e0d18a',
  )
  if (promoted) {
    center(ctx, `The Crown elevates you: ${title.toUpperCase()}!`, cx, viewH / 2 - 74, "bold 20px 'Courier New', monospace", '#7fd17f')
  } else {
    center(ctx, `Your rank: ${title}`, cx, viewH / 2 - 74, "18px 'Courier New', monospace", '#c9c9d2')
  }
  const idx = rankIndex(career.banked)
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null
  const lines = [
    `Treasury: ${career.banked} gold banked`,
    `Cities of Gold found: ${state.citiesFound}/7    Villages contacted: ${state.villagesContacted}`,
    `Word of your deeds — fear among the peoples: ${Math.floor(state.fear)}`,
    next ? `Next title (${next.title}) at ${next.min} gold banked` : 'No higher title remains',
    '',
    `The Crown will fund your next voyage: ${budgetFor(career.banked)} gold`,
  ]
  let y = viewH / 2 - 30
  for (const l of lines) {
    center(ctx, l, cx, y, "15px 'Courier New', monospace", '#9a9aa6')
    y += 26
  }
  center(ctx, 'Press ENTER to outfit your next voyage', cx, y + 22, "16px 'Courier New', monospace", '#7fd17f')
}

export function drawEncounter(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  v: Village,
  goods: number,
  fear = 0,
): void {
  const { x, y } = panel(ctx, viewW, viewH, Math.min(580, viewW - 24), 268)
  const cx = viewW / 2
  const title = v.golden ? 'A CITY OF GOLD!' : 'A native village'
  center(ctx, title, cx, y + 44, "bold 26px 'Courier New', monospace", v.golden ? '#f4c430' : '#e0d18a')

  const eff = effectiveTemperament(v.temperament, fear)
  const mood = eff > 0.66 ? 'friendly' : eff > 0.33 ? 'wary' : 'hostile'
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
    ctx.fillText(`[${k}]`, x + 32, ly)
    ctx.fillStyle = disabled ? '#5a5a64' : '#d7d7de'
    ctx.font = "15px 'Courier New', monospace"
    ctx.fillText(label + (disabled ? '  — no goods!' : ''), x + 76, ly)
    ly += 34
  }
  center(ctx, 'Esc — walk away', cx, y + 244, "14px 'Courier New', monospace", '#7a7a86')
}

export function drawResult(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, text: string): void {
  const { y } = panel(ctx, viewW, viewH, Math.min(460, viewW - 24), 90)
  center(ctx, text, viewW / 2, y + 54, "18px 'Courier New', monospace", '#7fd17f')
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  won: boolean,
  score: number,
  career?: Career,
): void {
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
  if (career) {
    const line = `${rankTitle(career.banked)} · ${career.voyages} ${career.voyages === 1 ? 'voyage' : 'voyages'} completed · ${career.banked} gold banked`
    center(ctx, line, cx, viewH / 2 + 70, "15px 'Courier New', monospace", '#c9a94f')
  }
  center(ctx, 'Press ENTER for a new expedition', cx, viewH / 2 + 108, "16px 'Courier New', monospace", '#7fd17f')
}
