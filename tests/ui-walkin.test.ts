import { describe, expect, test, vi } from 'vitest'
import { drawWalkin } from '../src/ui/walkin'
import { makeScene } from '../src/game/walkin'
import { CELL } from '../src/art/pixels'
import type { SpriteBank } from '../src/art/spritebank'
import type { Tileset } from '../src/art/tileset'
import { TILE } from '../src/world/tiles'
import type { Village } from '../src/world/villages'

const cell = (name: string) => ({ name }) as unknown as HTMLCanvasElement

function fakeBank(): SpriteBank {
  const facings = ['S', 'W', 'E', 'N']
  return {
    explorer: facings.map((f) => [0, 1, 2, 3].map((i) => cell(`fig-${f}${i}`))),
    ship: facings.map((f) => [cell(`ship-${f}0`), cell(`ship-${f}1`)]),
    anchor: { x: 12, explorerY: 20, shipY: 18 },
    cell: CELL,
  }
}

function fakeTileset(): Tileset {
  const frames = Array.from({ length: 16 }, (_, i) => cell(`grass-${i}`))
  return new Map([[TILE.GRASS, frames]])
}

function fakeVillage(overrides: Partial<Village> = {}): Village {
  return {
    x: 42,
    y: 28,
    wealth: 220,
    temperament: 0.25,
    population: 100,
    golden: false,
    visited: false,
    depleted: false,
    ...overrides,
  }
}

interface RecordedText {
  text: string
  x: number
  y: number
}

function fakeCtx(dpr = 1) {
  const texts: RecordedText[] = []
  const fills: unknown[] = []
  const strokes: unknown[] = []
  const scales: [number, number][] = []
  const drawImages: unknown[][] = []
  const gradients: number[][] = []
  let smoothing = true
  const noop = () => {}

  const ctx = {
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    lineWidth: 1,
    font: "14px 'Courier New', monospace",
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    get imageSmoothingEnabled() {
      return smoothing
    },
    set imageSmoothingEnabled(v: boolean) {
      smoothing = v
    },
    getTransform: () => ({ a: dpr }),
    save: noop,
    restore: noop,
    translate: noop,
    scale: (x: number, y: number) => scales.push([x, y]),
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    clip: noop,
    fill: () => fills.push(ctx.fillStyle),
    stroke: () => strokes.push(ctx.strokeStyle),
    fillRect: () => fills.push(ctx.fillStyle),
    strokeRect: () => strokes.push(ctx.strokeStyle),
    createRadialGradient: (...args: number[]) => {
      gradients.push(args)
      return { addColorStop: vi.fn() }
    },
    drawImage: (...args: unknown[]) => drawImages.push(args),
    measureText: (s: string) => ({ width: s.length * 8 }),
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y }),
  }

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    texts,
    fills,
    strokes,
    scales,
    drawImages,
    gradients,
    getSmoothing: () => smoothing,
  }
}

describe('drawWalkin', () => {
  test('renders ground tiles, integer-scaled explorer sprite, mood banner, and resets context alignment', () => {
    const scene = makeScene(fakeVillage(), 10)
    const { ctx, texts, scales, drawImages, getSmoothing } = fakeCtx(2)
    const bank = fakeBank()

    drawWalkin(ctx, 1280, 720, scene, fakeTileset(), 'The elders inspect your shiny boots.', bank, 1.25)

    // Every ground tile in the scene grid + 1 explorer sprite drawImage call
    expect(drawImages.length).toBe(scene.w * scene.h + 1)
    const lastCall = drawImages[drawImages.length - 1]
    expect(lastCall[0]).toBe(bank.explorer[scene.facing][0])

    // Explorer sprite scale * dpr must be an exact integer (no fractional pixel-art blur)
    expect(scales.length).toBe(1)
    const [sx, sy] = scales[0]
    expect(sx).toBe(sy)
    expect(Number.isInteger(sx * 2)).toBe(true)

    // Ground pass restores imageSmoothingEnabled after disabling it; explorer save/restore leaves it intact
    expect(getSmoothing()).toBe(false)
    expect(texts.some((t) => t.text === 'The elders inspect your shiny boots.')).toBe(true)
    expect(texts.some((t) => t.text.includes('Walk to the chief to parley'))).toBe(true)
    expect(ctx.textAlign).toBe('left')
    expect(ctx.textBaseline).toBe('alphabetic')
  })

  test('gilds roofs and draws golden idol in Cities of Gold', () => {
    const plainScene = makeScene(fakeVillage({ golden: false }), 0)
    const goldScene = makeScene(fakeVillage({ golden: true }), 0)
    const plain = fakeCtx()
    const gold = fakeCtx()

    drawWalkin(plain.ctx, 1000, 700, plainScene, fakeTileset(), 'Wary greeting', fakeBank(), 0.5)
    drawWalkin(gold.ctx, 1000, 700, goldScene, fakeTileset(), 'Gold-tone splendor!', fakeBank(), 0.5)

    // Golden roofs + idol add #f4c430 fills not present on normal village roofs
    const plainGoldFills = plain.fills.filter((f) => f === '#f4c430').length
    const goldCityFills = gold.fills.filter((f) => f === '#f4c430').length
    expect(goldCityFills).toBeGreaterThan(plainGoldFills)
  })

  test('applies hostile dusk vignette and crimson frame vs friendly warm light and gold frame', () => {
    // High fear forces hostile mood; low fear + high temperament gives friendly mood
    const hostileScene = makeScene(fakeVillage({ temperament: -0.9 }), 90)
    hostileScene.hostile = true
    const friendlyScene = makeScene(fakeVillage({ temperament: 0.9 }), 0)
    friendlyScene.hostile = false
    friendlyScene.mood = 0.8

    const hostile = fakeCtx()
    const friendly = fakeCtx()

    drawWalkin(hostile.ctx, 1000, 700, hostileScene, fakeTileset(), 'Run away!', fakeBank(), 2.0)
    drawWalkin(friendly.ctx, 1000, 700, friendlyScene, fakeTileset(), 'Welcome, traveler.', fakeBank(), 2.0)

    expect(hostile.gradients.length).toBe(1)
    expect(hostile.strokes).toContain('#c0504d')
    expect(friendly.gradients.length).toBe(0)
    expect(friendly.strokes).toContain('#f4c430')
    expect(friendly.fills).toContain('rgba(255,214,120,0.05)')
  })

  test('draws active villager emote puffs and skips expired or appeased villagers', () => {
    const scene = makeScene(fakeVillage({ population: 140 }), 5)
    expect(scene.villagers.length).toBeGreaterThanOrEqual(3)

    // 0: active emote, 1: expired emote, 2: appeased with emote
    scene.villagers[0].emote = '6-7!'
    scene.villagers[0].emoteT = 1.4
    scene.villagers[0].appeased = false

    scene.villagers[1].emote = 'Expired!'
    scene.villagers[1].emoteT = 0
    scene.villagers[1].appeased = false

    scene.villagers[2].emote = 'Appeased!'
    scene.villagers[2].emoteT = 2.0
    scene.villagers[2].appeased = true

    const { ctx, texts } = fakeCtx()
    drawWalkin(ctx, 1000, 700, scene, fakeTileset(), 'Curiosity abounds.', fakeBank(), 0.25)

    expect(texts.some((t) => t.text === '6-7!')).toBe(true)
    expect(texts.some((t) => t.text === 'Expired!')).toBe(false)
    expect(texts.some((t) => t.text === 'Appeased!')).toBe(false)
  })
})
