import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  invalidateMinimap,
  miniColor,
  renderMinimap,
  renderStorms,
  renderWorld,
  type RenderCtx,
  type WorldArt,
} from '../src/engine/renderer'
import { buildRelief } from '../src/art/relief'
import { CELL } from '../src/art/pixels'
import type { SpriteBank } from '../src/art/spritebank'
import { DEPTH_RAMP, type Tileset } from '../src/art/tileset'
import { Facing } from '../src/game/gait'
import { makeExplorer } from '../src/game/explorer'
import type { Outpost } from '../src/game/outposts'
import type { Weather } from '../src/game/weather'
import { beginHits, hitAt } from '../src/ui/hit'
import { makeFog, reveal } from '../src/world/fog'
import { generateMap } from '../src/world/mapgen'
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
  const map: Tileset = new Map()
  for (const t of Object.values(TILE)) {
    map.set(
      t,
      Array.from({ length: 48 }, (_, i) => cell(`tile-${t}-${i}`)),
    )
  }
  return map
}

function makeFakeCanvasCtx() {
  const drawImages: unknown[][] = []
  const fillRects: { x: number; y: number; w: number; h: number; style: unknown }[] = []
  const strokeRects: { x: number; y: number; w: number; h: number; style: unknown }[] = []
  const gradients: number[][] = []
  const alphas: number[] = []
  const patternTransforms: unknown[] = []
  let curAlpha = 1
  const noop = () => {}

  const ctx = {
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    lineWidth: 1,
    imageSmoothingEnabled: true,
    get globalAlpha() {
      return curAlpha
    },
    set globalAlpha(v: number) {
      curAlpha = v
      alphas.push(v)
    },
    save: noop,
    restore: noop,
    scale: noop,
    translate: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    fillRect: (x: number, y: number, w: number, h: number) => fillRects.push({ x, y, w, h, style: ctx.fillStyle }),
    strokeRect: (x: number, y: number, w: number, h: number) =>
      strokeRects.push({ x, y, w, h, style: ctx.strokeStyle }),
    drawImage: (...args: unknown[]) => drawImages.push(args),
    createPattern: () => ({
      setTransform: (m: unknown) => patternTransforms.push(m),
    }),
    createRadialGradient: (...args: number[]) => {
      gradients.push(args)
      return { addColorStop: noop }
    },
  }

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    drawImages,
    fillRects,
    strokeRects,
    gradients,
    alphas,
    patternTransforms,
  }
}

let createdCanvases = 0

beforeEach(() => {
  createdCanvases = 0
  invalidateMinimap()
  vi.stubGlobal(
    'DOMMatrix',
    class FakeDOMMatrix {
      values: number[]
      constructor(values: number[] = [1, 0, 0, 1, 0, 0]) {
        this.values = values
      }
    },
  )
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`unexpected tag ${tag}`)
      createdCanvases++
      const stub = makeFakeCanvasCtx()
      return {
        width: 0,
        height: 0,
        getContext: () => stub.ctx,
      }
    },
  })
})

afterEach(() => {
  invalidateMinimap()
  vi.unstubAllGlobals()
})

describe('miniColor', () => {
  test('maps every terrain type and hill/depth band to a distinct hex color', () => {
    expect(miniColor(TILE.OCEAN, 0, 0)).toBe(DEPTH_RAMP[0])
    expect(miniColor(TILE.OCEAN, 2, 0)).toBe(DEPTH_RAMP[2])
    expect(miniColor(TILE.RIVER, 0, 0)).toBe('#3a7ac0')
    expect(miniColor(TILE.BEACH, 0, 0)).toBe('#d8c88a')
    expect(miniColor(TILE.MOUNTAIN, 0, 0)).toBe('#4e4e4e')
    expect(miniColor(TILE.MOUNTAIN, 0, 1)).toBe('#6d6d6d')
    expect(miniColor(TILE.MOUNTAIN, 0, 2)).toBe('#8a8a8a')
    expect(miniColor(TILE.HIGHLAND, 0, 0)).toBe('#7a6c48')
    expect(miniColor(TILE.HIGHLAND, 0, 2)).toBe('#9a8a62')
    expect(miniColor(TILE.DESERT, 0, 0)).toBe('#c9a850')
    expect(miniColor(TILE.JUNGLE, 0, 0)).toBe('#1f5230')
    expect(miniColor(TILE.FOREST, 0, 0)).toBe('#2f6b2a')
    expect(miniColor(TILE.GRASS, 0, 0)).toBe('#3f6b34')
  })
})

describe('renderWorld', () => {
  function setupWorld() {
    const map = generateMap(6767)
    const fog = makeFog(map.width, map.height)
    const explorer = makeExplorer(map)
    reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), 8)
    const relief = buildRelief(map)
    const edges = new Map([[1, cell('edge-1')]])
    const edgeKeys = new Uint16Array(map.width * map.height)
    edgeKeys[Math.floor(explorer.y) * map.width + Math.floor(explorer.x)] = 1
    const deckles = new Map<number, HTMLCanvasElement>()
    for (let m = 1; m < 16; m++) {
      deckles.set(m * 2, cell(`deckle-${m}-0`))
      deckles.set(m * 2 + 1, cell(`deckle-${m}-1`))
    }
    const art: WorldArt = { relief, edges, edgeKeys, deckles, sprites: fakeBank() }
    return { map, fog, explorer, art }
  }

  test('draws anchored chart paper, seen tiles, fringes, deckles, entities, and explorer on foot', () => {
    const { map, fog, explorer, art } = setupWorld()
    const stub = makeFakeCanvasCtx()
    const rc: RenderCtx = { ctx: stub.ctx, viewW: 640, viewH: 360, tileset: fakeTileset(), zoom: 2 }
    const cam = { x: explorer.x, y: explorer.y }
    const ex = Math.floor(explorer.x)
    const ey = Math.floor(explorer.y)

    const villages: Village[] = [
      { x: ex, y: ey, wealth: 300, temperament: 0.4, population: 120, golden: true, visited: false, depleted: false },
      { x: ex + 1, y: ey, wealth: 0, temperament: 0, population: 40, golden: false, visited: true, depleted: true },
      // hidden in fog: must be skipped
      { x: 0, y: 0, wealth: 100, temperament: 0, population: 50, golden: false, visited: false, depleted: false },
    ]
    const outposts: Outpost[] = [{ x: ex - 1, y: ey, stock: 50 }]
    const ships = [{ x: explorer.x + 2, y: explorer.y, facing: Facing.W }]

    renderWorld(rc, cam, map, fog, villages, explorer, ships, 0, false, outposts, art)

    // Paper background was anchored with DOMMatrix transform
    expect(stub.patternTransforms.length).toBe(1)
    // Edge fringe and fog frontier deckles were blitted
    expect(stub.drawImages.some((c) => c[0] === art.edges.get(1))).toBe(true)
    expect(stub.drawImages.some((c) => String((c[0] as { name?: string })?.name).startsWith('deckle-'))).toBe(true)
    // Depleted village dropped alpha to 0.55 then restored to 1
    expect(stub.alphas).toContain(0.55)
    expect(stub.alphas[stub.alphas.length - 1]).toBe(1)
    // Both moored ship and explorer sprite were drawn
    expect(stub.drawImages.some((c) => c[0] === art.sprites.ship[Facing.W][0] || c[0] === art.sprites.ship[Facing.W][1])).toBe(true)
    expect(stub.drawImages.some((c) => c[0] === art.sprites.explorer[explorer.facing][0])).toBe(true)
    // Charted tiles beyond VIEW_RADIUS (5) get the dried-ink wash
    expect(stub.fillRects.some((r) => r.style === 'rgba(44,36,24,0.28)')).toBe(true)
  })

  test('draws flagship using explorer.facing when sailing and omits duplicate moored activeShip', () => {
    const { map, fog, explorer, art } = setupWorld()
    explorer.facing = Facing.N
    const stub = makeFakeCanvasCtx()
    const rc: RenderCtx = { ctx: stub.ctx, viewW: 640, viewH: 360, tileset: fakeTileset(), zoom: 2 }
    const ships = [{ x: explorer.x, y: explorer.y, facing: Facing.S }]

    renderWorld(rc, { x: explorer.x, y: explorer.y }, map, fog, [], explorer, ships, 0, true, [], art)

    const shipCalls = stub.drawImages.filter((c) => String((c[0] as { name?: string })?.name).startsWith('ship-'))
    expect(shipCalls.length).toBe(1)
    expect(String((shipCalls[0][0] as { name: string }).name)).toMatch(/^ship-N/)
  })

  test('switches to canoe when explorer stands on a river tile', () => {
    const { map, fog, explorer, art } = setupWorld()
    // Place explorer on a synthetic river tile
    const tx = Math.floor(explorer.x)
    const ty = Math.floor(explorer.y)
    map.tiles[ty * map.width + tx] = TILE.RIVER
    const stub = makeFakeCanvasCtx()
    const rc: RenderCtx = { ctx: stub.ctx, viewW: 640, viewH: 360, tileset: fakeTileset(), zoom: 2 }

    renderWorld(rc, { x: explorer.x, y: explorer.y }, map, fog, [], explorer, [], 0, false, [], art)

    // Explorer figure sprite is NOT drawn on river (canoe vector path is drawn instead)
    expect(stub.drawImages.some((c) => String((c[0] as { name?: string })?.name).startsWith('fig-'))).toBe(false)
  })
})

describe('renderStorms', () => {
  test('skips storms in fog and draws radial squall + rain for charted in-view storms', () => {
    const map = generateMap(1492)
    const fog = makeFog(map.width, map.height)
    const weather: Weather = {
      baseAngle: 0,
      phase: 0,
      storms: [
        // Stationary storm at (20, 20)
        { x0: 20, y0: 20, vx: 0, vy: 0, r: 5 },
      ],
    }
    const stubHidden = makeFakeCanvasCtx()
    const rcHidden: RenderCtx = { ctx: stubHidden.ctx, viewW: 640, viewH: 360, tileset: fakeTileset(), zoom: 2 }
    renderStorms(rcHidden, { x: 20, y: 20 }, weather, 0, map, fog)
    expect(stubHidden.gradients.length).toBe(0)

    reveal(fog, 20, 20, 3)
    const stubSeen = makeFakeCanvasCtx()
    const rcSeen: RenderCtx = { ctx: stubSeen.ctx, viewW: 640, viewH: 360, tileset: fakeTileset(), zoom: 2 }
    renderStorms(rcSeen, { x: 20, y: 20 }, weather, 0, map, fog)
    expect(stubSeen.gradients.length).toBe(1)
  })
})

describe('renderMinimap', () => {
  test('registers open-chart hit region, draws markers, and caches offscreen canvas until invalidated or >256 tiles revealed', () => {
    const map = generateMap(6767)
    const fog = makeFog(map.width, map.height)
    const explorer = makeExplorer(map)
    reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), 6)
    const relief = buildRelief(map)
    const stub = makeFakeCanvasCtx()
    const rc: RenderCtx = { ctx: stub.ctx, viewW: 1280, viewH: 720, tileset: fakeTileset(), zoom: 2 }
    const villages: Village[] = [
      {
        x: Math.floor(explorer.x),
        y: Math.floor(explorer.y),
        wealth: 400,
        temperament: 0.5,
        population: 100,
        golden: true,
        visited: false,
        depleted: false,
      },
    ]

    beginHits()
    renderMinimap(
      rc,
      map,
      fog,
      explorer,
      villages,
      [{ x: explorer.x, y: explorer.y }],
      [{ x: explorer.x, y: explorer.y, stock: 20 }],
      52,
      { x: explorer.x, y: explorer.y },
      relief,
    )

    // Minimap sits at (viewW - 120 - 12, 52) => [1146..1270, 50..174]
    expect(hitAt(1200, 100)).toBe('open-chart')
    expect(hitAt(100, 100)).toBeNull()
    expect(stub.fillRects.some((r) => r.style === '#f4c430')).toBe(true) // golden village
    expect(stub.fillRects.some((r) => r.style === '#ff5555')).toBe(true) // explorer
    expect(stub.fillRects.some((r) => r.style === '#cfe6ff')).toBe(true) // ship
    expect(stub.fillRects.some((r) => r.style === '#e8d8a0')).toBe(true) // outpost
    expect(createdCanvases).toBe(1)

    // Second render with same fog count reuses cached canvas
    renderMinimap(rc, map, fog, explorer, villages, [], [], 52, { x: explorer.x, y: explorer.y }, relief)
    expect(createdCanvases).toBe(1)

    // Revealing a big chunk (>256 tiles) rebuilds cache
    reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), 25)
    renderMinimap(rc, map, fog, explorer, villages, [], [], 52, { x: explorer.x, y: explorer.y }, relief)
    expect(createdCanvases).toBe(2)

    // invalidateMinimap forces rebuild on next render
    invalidateMinimap()
    renderMinimap(rc, map, fog, explorer, villages, [], [], 52, { x: explorer.x, y: explorer.y }, relief)
    expect(createdCanvases).toBe(3)
  })
})
