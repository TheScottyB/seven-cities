import type { Village } from '../world/villages'
import { Outfit, outfitCost, remainingBudget, PRICES, BUDGET } from '../game/outfit'
import { TRADE_GOODS, GIFT_GOODS, effectiveTemperament } from '../game/encounter'
import { bestScore, type ChronicleEntry } from '../game/chronicle'
import { rankTitle, rankIndex, budgetFor, RANKS, type Career } from '../game/career'
import { dailyAppetite, type GameState } from '../game/state'
import { addHit } from './hit'

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

/** Register a click region centred on a line of text drawn with `center`. */
function centerHit(ctx: CanvasRenderingContext2D, id: string, text: string, cx: number, y: number, font: string) {
  ctx.font = font
  const w = ctx.measureText(text).width + 24
  addHit(id, cx - w / 2, y - 20, w, 28)
}

// --- procedural ornament ---------------------------------------------------

/** Double gold rule around the screen with diamond corners — the map's frame. */
function drawFrame(ctx: CanvasRenderingContext2D, viewW: number, viewH: number): void {
  ctx.strokeStyle = 'rgba(244,196,48,0.45)'
  ctx.lineWidth = 1
  ctx.strokeRect(14.5, 14.5, viewW - 29, viewH - 29)
  ctx.strokeStyle = 'rgba(244,196,48,0.18)'
  ctx.strokeRect(20.5, 20.5, viewW - 41, viewH - 41)
  ctx.fillStyle = 'rgba(244,196,48,0.6)'
  for (const [x, y] of [[14.5, 14.5], [viewW - 14.5, 14.5], [14.5, viewH - 14.5], [viewW - 14.5, viewH - 14.5]]) {
    ctx.beginPath()
    ctx.moveTo(x, y - 5)
    ctx.lineTo(x + 5, y)
    ctx.lineTo(x, y + 5)
    ctx.lineTo(x - 5, y)
    ctx.closePath()
    ctx.fill()
  }
}

/** An eight-point compass rose for the chart's title. */
function drawCompassRose(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = 'rgba(154,154,166,0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2)
  ctx.stroke()
  // short diagonal points
  ctx.fillStyle = 'rgba(122,122,134,0.6)'
  for (let i = 0; i < 4; i++) {
    ctx.save()
    ctx.rotate(Math.PI / 4 + (i * Math.PI) / 2)
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.55)
    ctx.lineTo(r * 0.1, 0)
    ctx.lineTo(-r * 0.1, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // long cardinal points, gold north
  for (let i = 0; i < 4; i++) {
    ctx.save()
    ctx.rotate((i * Math.PI) / 2)
    ctx.fillStyle = i === 0 ? '#f4c430' : 'rgba(201,201,210,0.75)'
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(r * 0.13, 0)
    ctx.lineTo(-r * 0.13, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = '#0a0a12'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#f4c430'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/** The Crown's arms: a crown over a quartered shield. */
function drawCrest(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  // crown
  ctx.fillStyle = '#f4c430'
  ctx.fillRect(cx - s * 0.5, cy - s * 0.95, s, s * 0.16)
  for (const ox of [-0.42, 0, 0.42]) {
    ctx.beginPath()
    ctx.moveTo(cx + ox * s - s * 0.11, cy - s * 0.95)
    ctx.lineTo(cx + ox * s, cy - s * 1.22)
    ctx.lineTo(cx + ox * s + s * 0.11, cy - s * 0.95)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#b1372f'
  for (const ox of [-0.42, 0, 0.42]) ctx.fillRect(cx + ox * s - s * 0.035, cy - s * 1.2, s * 0.07, s * 0.07)
  // shield: quartered castle-gold and lion-red
  const w = s * 0.92
  const top = cy - s * 0.68
  const h = s * 1.15
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, top)
  ctx.lineTo(cx + w / 2, top)
  ctx.lineTo(cx + w / 2, top + h * 0.6)
  ctx.quadraticCurveTo(cx + w / 2, top + h * 0.92, cx, top + h)
  ctx.quadraticCurveTo(cx - w / 2, top + h * 0.92, cx - w / 2, top + h * 0.6)
  ctx.closePath()
  ctx.clip()
  ctx.fillStyle = '#8a3a2a'
  ctx.fillRect(cx - w / 2, top, w, h)
  ctx.fillStyle = '#c9a94f'
  ctx.fillRect(cx - w / 2, top, w / 2, h / 2)
  ctx.fillRect(cx, top + h / 2, w / 2, h / 2)
  // tiny castle marks on the gold quarters
  ctx.fillStyle = '#6a4a1a'
  ctx.fillRect(cx - w * 0.32, top + h * 0.16, w * 0.14, w * 0.14)
  ctx.fillRect(cx + w * 0.18, top + h * 0.66, w * 0.14, w * 0.14)
  ctx.restore()
  ctx.strokeStyle = '#f4c430'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, top)
  ctx.lineTo(cx + w / 2, top)
  ctx.lineTo(cx + w / 2, top + h * 0.6)
  ctx.quadraticCurveTo(cx + w / 2, top + h * 0.92, cx, top + h)
  ctx.quadraticCurveTo(cx - w / 2, top + h * 0.92, cx - w / 2, top + h * 0.6)
  ctx.closePath()
  ctx.stroke()
}

// --- screens ---------------------------------------------------------------

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
  drawFrame(ctx, viewW, viewH)
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
    const valStr = `< ${String(outfit[key]).padStart(3)} >`
    ctx.fillText(valStr, left + 260, y)
    // click targets: the label selects the row; the angle brackets adjust it
    addHit(`outfit-row-${i}`, left - 8, y - 20, 240, 28)
    const chW = ctx.measureText('<').width
    const valW = ctx.measureText(valStr).width
    addHit(`outfit-dec-${i}`, left + 250, y - 20, chW + 20, 28)
    addHit(`outfit-inc-${i}`, left + 260 + valW - chW - 10, y - 20, chW + 20, 28)
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
  const go = '↑↓ choose   ←→ adjust   ENTER set sail'
  center(ctx, go, cx, y + 62, "15px 'Courier New', monospace", '#7fd17f')
  centerHit(ctx, 'outfit-go', go, cx, y + 62, "15px 'Courier New', monospace")
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
  drawFrame(ctx, viewW, viewH)
  const cx = viewW / 2
  drawCompassRose(ctx, cx, viewH / 2 - 196, 34)
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
    if (l.startsWith('Press ENTER')) centerHit(ctx, 'start-new', l, cx, y, "16px 'Courier New', monospace")
    else if (l.startsWith('Press C')) centerHit(ctx, 'start-continue', l, cx, y, "16px 'Courier New', monospace")
    else if (l.startsWith('Seed:')) centerHit(ctx, 'start-reroll', l, cx, y, "16px 'Courier New', monospace")
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
  drawFrame(ctx, viewW, viewH)
  const cx = viewW / 2
  drawCrest(ctx, cx, viewH / 2 - 188, 42)
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
  const go = 'Press ENTER to outfit your next voyage'
  center(ctx, go, cx, y + 22, "16px 'Courier New', monospace", '#7fd17f')
  centerHit(ctx, 'spain-go', go, cx, y + 22, "16px 'Courier New', monospace")
}

export function drawEncounter(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  v: Village,
  goods: number,
  fear = 0,
): void {
  const w = Math.min(580, viewW - 24)
  const { x, y } = panel(ctx, viewW, viewH, w, 268)
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
    if (!disabled) addHit(`enc-${k}`, x + 24, ly - 20, w - 48, 30)
    ly += 34
  }
  const esc = 'Esc — walk away'
  center(ctx, esc, cx, y + 244, "14px 'Courier New', monospace", '#7a7a86')
  centerHit(ctx, 'enc-esc', esc, cx, y + 244, "14px 'Courier New', monospace")
}

/**
 * Transient notice as a slim banner under the HUD — it informs without
 * hiding the ship, the storm, or the village it is talking about.
 */
export function drawResult(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, text: string, top = 64): void {
  ctx.font = "16px 'Courier New', monospace"
  const w = Math.min(ctx.measureText(text).width + 48, viewW - 16)
  const x = (viewW - w) / 2
  ctx.fillStyle = 'rgba(10,12,22,0.88)'
  ctx.fillRect(x, top, w, 34)
  ctx.strokeStyle = 'rgba(244,196,48,0.7)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, top + 0.5, w - 1, 33)
  ctx.fillStyle = '#7fd17f'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, viewW / 2, top + 23)
  ctx.textAlign = 'left'
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
  drawFrame(ctx, viewW, viewH)
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
  const go = 'Press ENTER for a new expedition'
  center(ctx, go, cx, viewH / 2 + 108, "16px 'Courier New', monospace", '#7fd17f')
  centerHit(ctx, 'over-restart', go, cx, viewH / 2 + 108, "16px 'Courier New', monospace")
}
