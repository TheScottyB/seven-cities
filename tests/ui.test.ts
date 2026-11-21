import { describe, expect, test } from 'vitest'
import { beginHits, hitAt } from '../src/ui/hit'
import { drawHud } from '../src/ui/hud'
import { drawStartScreen, drawOutfitScreen, drawSpainScreen, drawEncounter, drawGameOver } from '../src/ui/panels'
import { makeState, scoreParts } from '../src/game/state'
import { defaultOutfit } from '../src/game/outfit'
import { makeCareer } from '../src/game/career'

interface DrawnText {
  text: string
  x: number
  y: number
  font: string
}

/** Minimal 2D context stub that records text and rect calls for layout tests. */
function fakeCtx() {
  const texts: DrawnText[] = []
  const rects: { x: number; y: number; w: number; h: number }[] = []
  const measured: string[] = []
  let curFont = "16px 'Courier New', monospace"
  const pxOf = (f: string) => {
    const m = /(\d+)px/.exec(f)
    return m ? Number(m[1]) : 16
  }
  const noop = () => {}
  const ctx = {
    get font() {
      return curFont
    },
    set font(v: string) {
      curFont = v
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    clip: noop,
    fill: noop,
    stroke: noop,
    strokeRect: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: (s: string) => {
      measured.push(s)
      return { width: s.length * pxOf(curFont) * 0.6 }
    },
    fillText: (text: string, x: number, y: number) => {
      texts.push({ text, x, y, font: curFont })
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      rects.push({ x, y, w, h })
    },
  } as unknown as CanvasRenderingContext2D
  return { ctx, texts, rects, measured }
}

describe('drawHud', () => {
  test('wraps onto extra rows on narrow viewports and marks low resources with !', () => {
    const wide = fakeCtx()
    const lowState = makeState({ food: 40, goods: 10, fear: 60 })
    const hWide = drawHud(wide.ctx, 1280, lowState, 500)
    expect(hWide).toBe(40)
    const values = wide.texts.map((t) => t.text)
    expect(values).toContain('40!')
    expect(values).toContain('10!')
    expect(values).toContain('60!')
    expect(values).toContain('Bank:')

    const narrow = fakeCtx()
    const hNarrow = drawHud(narrow.ctx, 400, lowState, 500)
    expect(hNarrow).toBeGreaterThan(hWide)
  })
})

describe('panels layout & hit regions', () => {
  test('drawStartScreen skips measuring the Chronicle heading when the Chronicle is empty', () => {
    const empty = fakeCtx()
    beginHits()
    drawStartScreen(empty.ctx, 420, 700, '1492', false, [], { needKeyboard: true })
    expect(empty.measured.some((s) => s.includes('CHRONICLE'))).toBe(false)

    const withChron = fakeCtx()
    beginHits()
    drawStartScreen(withChron.ctx, 420, 700, '1492', false, [
      { seedStr: '1', won: true, score: 99999, gold: 5000, day: 120, cities: 7 },
    ])
    expect(withChron.measured.some((s) => s.includes('CHRONICLE'))).toBe(true)
  })

  test('drawStartScreen gates start hits behind needKeyboard', () => {
    const { ctx, texts } = fakeCtx()
    beginHits()
    drawStartScreen(ctx, 1000, 700, '1492', true, [], { needKeyboard: true })
    const kb = texts.find((t) => t.text === 'I have a keyboard')!
    expect(hitAt(kb.x, kb.y - 6)).toBe('start-keyboard')
    expect(texts.some((t) => t.text.includes('Press ENTER'))).toBe(false)
  })

  test('drawSpainScreen hides the harbor on short viewports so the action line is never covered', () => {
    const tall = fakeCtx()
    beginHits()
    drawSpainScreen(tall.ctx, 1280, 800, { banked: 1500, voyages: 1 }, makeState(), 1500, true, 0)
    const goTall = tall.texts.find((t) => t.text.includes('Press ENTER'))!
    expect(hitAt(goTall.x, goTall.y - 6)).toBe('spain-go')
    // harbor water rect exists at y = 800 - 132 = 668
    expect(tall.rects.some((r) => r.y === 800 - 132)).toBe(true)

    const short = fakeCtx()
    beginHits()
    drawSpainScreen(short.ctx, 1000, 520, { banked: 1500, voyages: 1 }, makeState(), 1500, false, 0)
    const goShort = short.texts.find((t) => t.text.includes('Press ENTER'))!
    expect(hitAt(goShort.x, goShort.y - 6)).toBe('spain-go')
    // harbor yielded — no water rect drawn over the court text
    expect(short.rects.some((r) => r.y === 520 - 132)).toBe(false)
  })

  test('drawOutfitScreen registers clickable set-sail and row controls on narrow viewports', () => {
    const { ctx, texts } = fakeCtx()
    beginHits()
    drawOutfitScreen(ctx, 500, 600, defaultOutfit(), 0, 500, true)
    const go = texts.find((t) => t.text.includes('ENTER set sail'))!
    expect(hitAt(go.x, go.y - 6)).toBe('outfit-go')
    const food = texts.find((t) => t.text.includes('Food'))!
    expect(hitAt(food.x + 10, food.y - 6)).toBe('outfit-row-0')
  })

  test('drawEncounter registers all four parley actions including Amaze', () => {
    const { ctx, texts } = fakeCtx()
    beginHits()
    drawEncounter(
      ctx,
      800,
      600,
      { x: 10, y: 12, wealth: 300, temperament: 0.5, population: 120, golden: true, visited: true, depleted: false },
      50,
      0,
      0,
      'Cibola (14k Gold-Tone)',
    )
    expect(texts.some((t) => t.text === 'CIBOLA (14K GOLD-TONE)!')).toBe(true)
    const amaze = texts.find((t) => t.text === '[4] Amaze')!
    expect(hitAt(amaze.x + 10, amaze.y - 6)).toBe('enc-4')
  })

  test('drawGameOver registers restart hit and fits title on narrow windows', () => {
    const { ctx, texts } = fakeCtx()
    beginHits()
    const st = makeState({ gold: 200, citiesFound: 7, day: 10 })
    drawGameOver(ctx, 480, 640, true, 1000, makeCareer(), { cities: 7, day: 10, parts: scoreParts(st, 400) }, 0)
    const title = texts.find((t) => t.text === 'THE SIX-SEVEN CITIES ARE YOURS')!
    const px = Number(/(\d+)px/.exec(title.font)![1])
    expect(px).toBeLessThan(36) // fitFont stepped down for 480px width
    const go = texts.find((t) => t.text.includes('Press ENTER'))!
    expect(hitAt(go.x, go.y - 6)).toBe('over-restart')
  })
})
