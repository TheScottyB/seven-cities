import { CITIES_OF_GOLD, type Village } from '../world/villages'
import { type Outfit, outfitCost, remainingBudget, PRICES, BUDGET } from '../game/outfit'
import { TRADE_GOODS, GIFT_GOODS, effectiveTemperament, moodOf, type Mood } from '../game/encounter'
import { bestScore, type ChronicleEntry } from '../game/chronicle'
import { rankTitle, rankIndex, budgetFor, RANKS, type Career } from '../game/career'
import { dailyAppetite, type GameState, type ScoreParts } from '../game/state'
import { addHit, hovered } from './hit'
import { font } from './font'
import { drawChief, drawIdol, drawShip, drawVillager, drawShadow, drawVillage } from '../art/sprites'

function panel(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, w: number, h: number, border = '#f4c430') {
  const x = (viewW - w) / 2
  const y = (viewH - h) / 2
  ctx.fillStyle = 'rgba(10,12,22,0.94)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = border
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
  /** a fresh expedition will overwrite the single save slot */
  replacesSave = false,
): void {
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, viewW, viewH)
  drawFrame(ctx, viewW, viewH)
  const cx = viewW / 2
  center(ctx, 'OUTFIT YOUR EXPEDITION', cx, viewH / 2 - 150, font(32, true), '#f4c430')
  center(
    ctx,
    `The Crown grants you ${budget} gold. Spend it well — what remains sails with you.`,
    cx,
    viewH / 2 - 112,
    font(15),
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
    ctx.font = font(sel ? 20 : 18, sel)
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
    ctx.font = font(13)
    ctx.fillStyle = '#7a7a86'
    ctx.fillText(desc, left + 24, y + 20)
    y += 58
  })

  center(
    ctx,
    `Spent: ${outfitCost(outfit)}    Sails as gold: ${remainingBudget(outfit, budget)}`,
    cx,
    y + 8,
    font(17),
    '#e0d18a',
  )
  const perDay = dailyAppetite(outfit.crew)
  const days = perDay > 0 ? outfit.food / perDay : 0
  const short = days < 5
  // said in words too, not by colour alone; no longer than the normal line
  const larder = short ? `too little: ~${days.toFixed(1)} days` : `this larder lasts ~${days.toFixed(1)} days`
  center(
    ctx,
    `${short ? '! ' : ''}A crew of ${outfit.crew} eats ~${Math.round(perDay)} provisions a day — ${larder}`,
    cx,
    y + 34,
    font(14),
    short ? '#c0504d' : '#7a9a7a',
  )
  const go = '↑↓ choose   ←→ adjust   ENTER set sail'
  center(ctx, go, cx, y + 62, font(15), '#7fd17f')
  centerHit(ctx, 'outfit-go', go, cx, y + 62, font(15))
  if (replacesSave) {
    center(ctx, 'Setting sail replaces your saved expedition. Esc to go back.', cx, y + 88, font(14), '#c9a94f')
  }
}

export interface StartScreenOptions {
  /** a quiet line on how to get sound, or how to mute it */
  soundLine?: string
  /** touch-only device: ask for a keyboard instead of offering a run */
  needKeyboard?: boolean
}

export function drawStartScreen(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  seed: string,
  hasSave: boolean,
  chronicle: ChronicleEntry[] = [],
  opts: StartScreenOptions = {},
): void {
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, viewW, viewH)
  drawFrame(ctx, viewW, viewH)
  const cx = viewW / 2

  const dim = '#9a9aa6'
  const lines: { text: string; color: string; hit?: string }[] = [
    'Chart the unknown coast and interior. Find native villages —',
    'trade with them, win them over with gifts, or raid them for gold.',
    'Manage food, crew, and morale, and find all seven Cities of Gold.',
    'Sail off the western edge to bank gold in Spain.',
    '',
    'MOVE  W A S D / arrows      INTERACT  E / Space      CHOOSE  1 2 3',
    'FORT  F      SOUND  M      MENU  Esc',
    '',
  ].map((text) => ({ text, color: dim }))
  lines.push({ text: `Seed: ${seed}   (R rolls a new world)`, color: dim, hit: 'start-reroll' })
  lines.push({ text: '', color: dim })
  if (opts.needKeyboard) {
    // no start regions at all: a tap must not begin a run it cannot play
    lines.push({ text: 'This expedition needs a keyboard —', color: '#e0b34f' })
    lines.push({ text: 'open it in a desktop browser', color: '#e0b34f' })
    lines.push({ text: 'I have a keyboard', color: '#7fd17f', hit: 'start-keyboard' })
  } else {
    lines.push({ text: 'Press ENTER to outfit a new expedition', color: '#7fd17f', hit: 'start-new' })
    if (hasSave) lines.push({ text: 'Press C to continue your last expedition', color: '#f4c430', hit: 'start-continue' })
  }
  if (opts.soundLine) lines.push({ text: opts.soundLine, color: '#7a7a86' })

  // measure the whole block, then centre it; only the Chronicle gives up rows
  const HEAD = 200 // compass top to the first line's baseline
  const LINE = 26
  const ROW = 21
  const CHRON_HEAD = 18 + 24 // gap, then heading to first row
  const wantRows = Math.min(4, chronicle.length)
  const total = HEAD + lines.length * LINE + (wantRows ? CHRON_HEAD + wantRows * ROW : 0)
  const top = Math.max(28, Math.round((viewH - total) / 2))

  drawCompassRose(ctx, cx, top + 34, 34)
  center(ctx, 'THE SEVEN CITIES OF GOLD', cx, top + 110, font(40, true), '#f4c430')
  center(ctx, 'A modern expedition into the New World', cx, top + 148, font(18), '#c9c9d2')

  const lineFont = font(16)
  let y = top + HEAD
  for (const l of lines) {
    center(ctx, l.text, cx, y, lineFont, l.color)
    if (l.hit) centerHit(ctx, l.hit, l.text, cx, y, lineFont)
    y += LINE
  }

  // the Chronicle: past expeditions, newest first, as many rows as fit
  const firstRow = y + CHRON_HEAD
  const rows = Math.max(0, Math.min(wantRows, Math.floor((viewH - 28 - firstRow + ROW) / ROW)))
  if (rows) {
    y += 18
    const best = bestScore(chronicle)
    center(ctx, `— CHRONICLE OF EXPEDITIONS · best score ${best} —`, cx, y, font(15, true), '#f4c430')
    y += 24
    for (const e of chronicle.slice(0, rows)) {
      const verdict = e.won ? ' WON' : 'LOST'
      const line = `${verdict}   score ${String(e.score).padStart(5)}   ${String(e.gold).padStart(4)} gold   ${e.cities}/${CITIES_OF_GOLD} cities   day ${e.day}`
      center(ctx, line, cx, y, font(14), e.won ? '#e0d18a' : '#8a8a94')
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
  t = 0,
): void {
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, viewW, viewH)
  drawFrame(ctx, viewW, viewH)
  const cx = viewW / 2
  drawCrest(ctx, cx, viewH / 2 - 208, 42)
  const title = rankTitle(career.banked)
  center(ctx, 'SPAIN — THE COURT OF THE CROWN', cx, viewH / 2 - 170, font(32, true), '#f4c430')
  center(
    ctx,
    `Voyage ${career.voyages} complete. You banked ${justBanked} gold with the Crown.`,
    cx,
    viewH / 2 - 128,
    font(16),
    '#e0d18a',
  )
  if (promoted) {
    // the moment glows: a new title from the Crown's own hand
    ctx.save()
    ctx.shadowColor = 'rgba(127,209,127,0.9)'
    ctx.shadowBlur = 10 + 6 * Math.sin(t * 4)
    center(ctx, `The Crown elevates you: ${title.toUpperCase()}!`, cx, viewH / 2 - 94, font(20, true), '#7fd17f')
    ctx.restore()
  } else {
    center(ctx, `Your rank: ${title}`, cx, viewH / 2 - 94, font(18), '#c9c9d2')
  }
  const idx = rankIndex(career.banked)
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null
  const lines = [
    `Treasury: ${career.banked} gold banked`,
    `Cities of Gold found: ${state.citiesFound}/${CITIES_OF_GOLD}    Villages contacted: ${state.villagesContacted}`,
    `Word of your deeds — fear among the peoples: ${Math.floor(state.fear)}`,
  ]
  let y = viewH / 2 - 52
  for (const l of lines) {
    center(ctx, l, cx, y, font(15), '#9a9aa6')
    y += 26
  }

  // the road to the next title, drawn as a bar the eye can measure
  if (next) {
    const prevMin = RANKS[idx].min
    const frac = Math.max(0, Math.min(1, (career.banked - prevMin) / (next.min - prevMin)))
    const bw = 320
    const bx = cx - bw / 2
    center(ctx, `Next title: ${next.title} at ${next.min} gold`, cx, y + 6, font(14), '#8a8a94')
    ctx.fillStyle = '#22222c'
    ctx.fillRect(bx, y + 14, bw, 10)
    ctx.fillStyle = '#c9a94f'
    ctx.fillRect(bx, y + 14, bw * frac, 10)
    ctx.strokeStyle = 'rgba(244,196,48,0.5)'
    ctx.lineWidth = 1
    ctx.strokeRect(bx + 0.5, y + 14.5, bw - 1, 9)
  } else {
    center(ctx, 'No higher title remains — the Crown has run out of honors', cx, y + 12, font(14), '#c9a94f')
  }
  y += 44
  center(ctx, `The Crown will fund your next voyage: ${budgetFor(career.banked)} gold`, cx, y + 6, font(15), '#9a9aa6')
  // what happens to this voyage's stores; breaks at the semicolon on narrow screens
  const leftoverFont = font(13)
  const leftover = ['Leftover stores stay behind;', 'your caravels return to Palos and sail again from the landing.']
  ctx.font = leftoverFont
  const leftoverLines = ctx.measureText(leftover.join(' ')).width <= viewW - 96 ? [leftover.join(' ')] : leftover
  leftoverLines.forEach((l, i) => center(ctx, l, cx, y + 28 + i * 17, leftoverFont, '#8a8a94'))
  const goY = y + 56 + (leftoverLines.length - 1) * 17

  const go = 'Press ENTER to outfit your next voyage'
  center(ctx, go, cx, goY, font(16), hovered('spain-go') ? '#a8f0a8' : '#7fd17f')
  centerHit(ctx, 'spain-go', go, cx, goY, font(16))

  // --- the harbor of Palos, waiting below the court -------------------------
  const hy = viewH - 132 // waterline
  ctx.save()
  ctx.beginPath()
  ctx.rect(24, hy - 60, viewW - 48, 160)
  ctx.clip()
  // evening water
  ctx.fillStyle = '#12233c'
  ctx.fillRect(24, hy, viewW - 48, 108)
  for (let row = 0; row < 4; row++) {
    const wy = hy + 12 + row * 22
    ctx.fillStyle = `rgba(120,160,210,${0.16 - row * 0.03})`
    for (let i = 0; i < 22; i++) {
      const phase = (t * (14 + row * 4) + i * 53 + row * 31) % (viewW - 48)
      ctx.fillRect(24 + phase, wy + Math.sin(t * 1.4 + i) * 1.5, 14 - row * 2, 1)
    }
  }
  // the caravel rides at anchor, sails furled for the night ashore
  ctx.save()
  ctx.translate(cx + 150, hy + 26)
  ctx.scale(3.4, 3.4)
  drawShip(ctx, 0, 0, t)
  ctx.restore()
  // the quay: dark planks and pilings, the Crown's gold stacked upon it
  ctx.fillStyle = '#2e2015'
  ctx.fillRect(24, hy - 14, Math.min(viewW * 0.38, 420), 20)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  for (let px = 44; px < Math.min(viewW * 0.38, 420); px += 34) ctx.fillRect(px, hy - 14, 2, 20)
  ctx.fillStyle = '#241a10'
  for (const px of [60, 180, 300]) ctx.fillRect(px, hy + 4, 8, 26)
  // banked treasure on the dock: one chest per rank of wealth
  const stacks = Math.min(7, 1 + Math.floor(career.banked / 600))
  for (let s = 0; s < stacks; s++) {
    const sx0 = 70 + s * 40
    const coins = 3 + ((s * 7) % 3)
    for (let c = 0; c < coins; c++) {
      ctx.fillStyle = c === coins - 1 ? '#ffe27a' : '#c9a94f'
      ctx.beginPath()
      ctx.ellipse(sx0, hy - 18 - c * 5, 9, 3.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

const MOOD_COLOR: Record<Mood, string> = { friendly: '#7fd17f', wary: '#e0b34f', hostile: '#c0504d' }
/** what the mood means for the deal on the table */
const MOOD_TERMS: Record<Mood, string> = { friendly: 'generous terms', wary: 'they bargain hard', hostile: 'they want you gone' }

export function drawEncounter(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  v: Village,
  goods: number,
  fear = 0,
  t = 0,
): void {
  const eff = effectiveTemperament(v.temperament, fear)
  const mood = moodOf(eff)
  const hostile = mood === 'hostile'
  const w = Math.min(600, viewW - 24)
  const H = 332
  const { x, y } = panel(ctx, viewW, viewH, w, H, hostile ? '#c0504d' : '#f4c430')
  const cx = viewW / 2
  const title = v.golden ? 'A CITY OF GOLD!' : 'A native village'
  center(ctx, title, cx, y + 40, font(26, true), v.golden ? '#f4c430' : '#e0d18a')

  // the delegation: the chief comes out to meet you, people at his back
  const gy = y + 58
  const gh = 76
  ctx.save()
  ctx.beginPath()
  ctx.rect(x + 14, gy, w - 28, gh)
  ctx.clip()
  ctx.fillStyle = { hostile: '#43302a', wary: '#44523a', friendly: '#3d5f32' }[mood]
  ctx.fillRect(x + 14, gy, w - 28, gh)
  const rng0 = ((v.x * 73856093) ^ (v.y * 19349663)) >>> 0
  ctx.fillStyle = 'rgba(20,28,16,0.5)'
  for (let i = 0; i < 40; i++) {
    const hx = x + 14 + ((rng0 >> (i % 24)) * 31 + i * 137) % (w - 28)
    const hy = gy + ((rng0 >> (i % 16)) * 17 + i * 61) % gh
    ctx.fillRect(hx, hy, 2, 2)
  }
  const base = gy + gh - 24
  const villagerCount = Math.max(2, Math.min(6, Math.round(v.population / 90)))
  for (let i = 0; i < villagerCount; i++) {
    const side = i % 2 ? 1 : -1
    const off = (Math.floor(i / 2) + 1) * 46 + 38
    const bob = Math.sin(t * (hostile ? 8 : 2.4) + i * 1.4) * (hostile ? 2 : 1)
    drawShadow(ctx, cx + side * off, base + 8, 9)
    drawVillager(ctx, cx + side * off, base + bob, 30, i + v.x)
  }
  if (v.golden) drawIdol(ctx, cx + 42, base + 2, 34, t)
  drawShadow(ctx, cx, base + 10, 12)
  drawChief(ctx, cx, base, 36)
  ctx.restore()
  ctx.strokeStyle = 'rgba(244,196,48,0.25)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 14.5, gy + 0.5, w - 29, gh)

  const moodColor = MOOD_COLOR[mood]
  ctx.font = font(15)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#9a9aa6'
  const pre = `They appear `
  const post = `. (pop. ~${v.population})   Your goods: ${Math.floor(goods)}`
  const total = ctx.measureText(pre + mood + post).width
  ctx.textAlign = 'left'
  let mx = cx - total / 2
  ctx.fillText(pre, mx, y + 158)
  mx += ctx.measureText(pre).width
  ctx.fillStyle = moodColor
  ctx.fillText(mood, mx, y + 158)
  mx += ctx.measureText(mood).width
  ctx.fillStyle = '#9a9aa6'
  ctx.fillText(post, mx, y + 158)

  const terms = MOOD_TERMS[mood]
  const noGoods = goods <= 0
  // [key, verb, description, disabled, what to say instead when disabled]
  const opts: [string, string, string, boolean, string][] = [
    ['1', 'Trade', `goods for gold & food (${TRADE_GOODS}) — ${terms}`, noGoods, 'no goods left to trade'],
    ['2', 'Gift', `earn goodwill & rumors (${GIFT_GOODS} goods)`, noGoods, 'no goods to give'],
    ['3', 'Attack', `seize their gold (risks crew${v.population > 250 ? ', many defenders' : ''})`, false, ''],
  ]
  let ly = y + 192
  for (const [k, verb, desc, disabled, instead] of opts) {
    const hov = !disabled && hovered(`enc-${k}`)
    if (hov) {
      ctx.fillStyle = 'rgba(244,196,48,0.09)'
      ctx.fillRect(x + 20, ly - 20, w - 40, 30)
    }
    ctx.font = font(17, true)
    ctx.fillStyle = disabled ? '#5a5a64' : hov ? '#ffe27a' : '#f4c430'
    ctx.fillText(`[${k}] ${verb}`, x + 32, ly)
    ctx.fillStyle = disabled ? '#5a5a64' : hov ? '#f0f0f4' : '#c9c9d2'
    const text = disabled ? instead : desc
    ctx.font = font(14)
    // the description runs from x + 150 to the panel's inner edge; step down rather than squeeze
    if (ctx.measureText(text).width > w - 170) ctx.font = font(13)
    ctx.fillText(text, x + 150, ly)
    if (!disabled) addHit(`enc-${k}`, x + 20, ly - 20, w - 40, 30)
    ly += 34
  }
  const esc = 'Esc — walk away'
  center(ctx, esc, cx, y + H - 22, font(14), hovered('enc-esc') ? '#c9c9d2' : '#7a7a86')
  centerHit(ctx, 'enc-esc', esc, cx, y + H - 22, font(14))
}

/**
 * Transient notice as a slim banner under the HUD — it informs without
 * hiding the ship, the storm, or the village it is talking about.
 */
export function drawResult(ctx: CanvasRenderingContext2D, viewW: number, text: string, top = 64): void {
  // long notices step the font down to fit the view before anything is clipped
  let size = 16
  ctx.font = font(size)
  while (size > 11 && ctx.measureText(text).width + 48 > viewW - 16) {
    size--
    ctx.font = font(size)
  }
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
  ctx.fillText(text, viewW / 2, top + 23, w - 16)
  ctx.textAlign = 'left'
}

/** The ledger a game-over settles: what the expedition amounted to. */
export interface ExpeditionSummary {
  cities: number
  day: number
  /** the score's terms; with the career's banked gold they sum to the final score */
  parts: ScoreParts
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  won: boolean,
  score: number,
  career: Career,
  summary: ExpeditionSummary,
  t = 0,
): void {
  // victory keeps a little warmth in the dark; defeat goes cold and red
  ctx.fillStyle = won ? 'rgba(10,8,4,0.88)' : 'rgba(8,4,6,0.92)'
  ctx.fillRect(0, 0, viewW, viewH)
  if (!won) {
    const vig = ctx.createRadialGradient(
      viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.3,
      viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.7,
    )
    vig.addColorStop(0, 'rgba(90,16,14,0)')
    vig.addColorStop(1, 'rgba(90,16,14,0.28)')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, viewW, viewH)
  }
  drawFrame(ctx, viewW, viewH)
  const cx = viewW / 2

  // the seven cities, tallied: gold for each one found, ash for the rest
  const cities = summary.cities
  const arcY = viewH / 2 - 128
  const mid = (CITIES_OF_GOLD - 1) / 2
  for (let i = 0; i < CITIES_OF_GOLD; i++) {
    const ax = cx + (i - mid) * 64
    const ay = arcY + (i - mid) * (i - mid) * 3.4 // outer cities dip — a strand of beads
    const found = i < cities
    ctx.save()
    ctx.translate(ax, ay)
    ctx.scale(1.7, 1.7)
    if (found) {
      // each found city gleams in its turn
      ctx.globalAlpha = 0.82 + 0.18 * Math.sin(t * 2.2 - i * 0.9)
      drawVillage(ctx, 0, 0, true, false)
    } else {
      ctx.globalAlpha = 0.28
      drawVillage(ctx, 0, 0, false, false)
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }

  if (won) {
    // gold dust rises off the treasure
    ctx.fillStyle = '#ffe27a'
    for (let i = 0; i < 18; i++) {
      const ph = (t * 0.12 + i * 0.055) % 1
      const px = cx + Math.sin(i * 2.7 + t * 0.4) * (viewW * 0.28) + (i - 9) * 14
      ctx.globalAlpha = 0.5 * (1 - ph)
      ctx.fillRect(px, viewH * 0.78 - ph * viewH * 0.5, 2, 2)
    }
    ctx.globalAlpha = 1
    ctx.save()
    ctx.shadowColor = 'rgba(244,196,48,0.8)'
    ctx.shadowBlur = 12 + 5 * Math.sin(t * 2.6)
    center(ctx, 'THE SEVEN CITIES ARE YOURS', cx, viewH / 2 - 40, font(36, true), '#f4c430')
    ctx.restore()
    center(ctx, 'Glory and gold beyond measure.', cx, viewH / 2 - 6, font(18), '#e0d18a')
  } else {
    center(ctx, 'THE EXPEDITION IS LOST', cx, viewH / 2 - 40, font(36, true), '#c0504d')
    center(ctx, 'Your crew will chart no more. The sea keeps its secrets.', cx, viewH / 2 - 6, font(18), '#c9c9d2')
  }

  center(ctx, `Final score: ${score}`, cx, viewH / 2 + 40, font(22), '#ffffff')
  // the reckoning, item by item — how the score came to be
  const p = summary.parts
  const terms = [
    `${p.gold} gold`,
    `+${p.charted} lands charted`,
    `+${p.villages} peoples met`,
    `−${Math.abs(p.days)} for ${summary.day} ${summary.day === 1 ? 'day' : 'days'} at large`,
  ]
  if (career.banked > 0) terms.push(`+${career.banked} banked`)
  const termsFont = font(13)
  ctx.font = termsFont
  const wide = terms.join('   ·   ')
  const reckoning = ctx.measureText(wide).width <= viewW - 48 ? wide : terms.join(' · ')
  center(ctx, reckoning, cx, viewH / 2 + 66, termsFont, '#8a8a94')
  const standing = `${rankTitle(career.banked)} · ${career.voyages} ${career.voyages === 1 ? 'voyage' : 'voyages'} completed · ${career.banked} gold banked`
  center(ctx, standing, cx, viewH / 2 + 94, font(15), '#c9a94f')
  const go = 'Press ENTER for a new expedition'
  center(ctx, go, cx, viewH / 2 + 132, font(16), hovered('over-restart') ? '#a8f0a8' : '#7fd17f')
  centerHit(ctx, 'over-restart', go, cx, viewH / 2 + 132, font(16))
}
