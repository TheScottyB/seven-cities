import type { GameMap } from '../src/world/mapgen'
import type { Village } from '../src/world/villages'
import type { Outpost } from '../src/game/outposts'
import type { Ship } from '../src/game/ship'
import {
  interactionTarget,
  nearestVillage,
  nearestOutpost,
  nearestShipIndex,
  SPAIN_EDGE_X,
  INTERACT_DIST,
  BOARD_DIST,
  RUMOR_RADIUS,
} from '../src/game/interact'
import { TILE } from '../src/world/tiles'

/** Ocean in columns [0, coastX), grass from coastX east. */
function halfMap(coastX: number, width = 20, height = 8): GameMap {
  const tiles = new Uint8Array(width * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) tiles[y * width + x] = x < coastX ? TILE.OCEAN : TILE.GRASS
  return { width, height, tiles, landing: { x: coastX, y: 0 }, seed: 0, elevation: new Float32Array(width * height) }
}

function village(x: number, y: number, over: Partial<Village> = {}): Village {
  return { x, y, wealth: 10, temperament: 0.5, population: 50, golden: false, visited: false, depleted: false, ...over }
}

const map = halfMap(12)
const ashore = { x: 15.5, y: 3.5 }

function target(over: {
  sailing?: boolean
  explorer?: { x: number; y: number }
  villages?: Village[]
  outposts?: Outpost[]
  ships?: Ship[]
  map?: GameMap
}) {
  return interactionTarget({
    map: over.map ?? map,
    sailing: over.sailing ?? false,
    explorer: over.explorer ?? ashore,
    villages: over.villages ?? [],
    outposts: over.outposts ?? [],
    ships: over.ships ?? [],
  })
}

test('distances match the tuned values', () => {
  expect(SPAIN_EDGE_X).toBe(4)
  expect(INTERACT_DIST).toBe(1.4)
  expect(BOARD_DIST).toBe(2.0)
  expect(RUMOR_RADIUS).toBe(4)
})

describe('ashore', () => {
  const v = village(15, 3)
  const o: Outpost = { x: 15, y: 3, stock: 10 }
  const sh: Ship = { x: 15.5, y: 3.5 }

  test('village beats outpost beats ship', () => {
    expect(target({ villages: [v], outposts: [o], ships: [sh] })).toEqual({ kind: 'village', village: v })
    expect(target({ outposts: [o], ships: [sh] })).toEqual({ kind: 'outpost', outpost: o })
    expect(target({ ships: [sh] })).toEqual({ kind: 'ship', index: 0 })
  })

  test('returns the very objects passed in', () => {
    const t = target({ villages: [v] })
    expect(t?.kind === 'village' && t.village).toBe(v)
  })

  test('a depleted village is skipped', () => {
    const gone = village(15, 3, { depleted: true })
    expect(target({ villages: [gone], outposts: [o] })).toEqual({ kind: 'outpost', outpost: o })
    expect(nearestVillage([gone], ashore.x, ashore.y)).toBeNull()
  })

  test('an outpost with stock 0.5 is skipped', () => {
    const bare: Outpost = { x: 15, y: 3, stock: 0.5 }
    expect(target({ outposts: [bare], ships: [sh] })).toEqual({ kind: 'ship', index: 0 })
    expect(target({ outposts: [bare] })).toBeNull()
  })

  test('only the nearest outpost is weighed: a bare one hides a stocked one behind it', () => {
    const bare: Outpost = { x: 15, y: 3, stock: 0 }
    const stocked: Outpost = { x: 16, y: 3, stock: 50 } // 1.0 away, inside INTERACT_DIST
    expect(nearestOutpost([bare, stocked], ashore.x, ashore.y)).toBe(bare)
    expect(target({ outposts: [bare, stocked] })).toBeNull()
  })

  test('nearest wins, and INTERACT_DIST is inclusive', () => {
    const near = village(15, 3)
    const far = village(16, 3)
    expect(nearestVillage([far, near], ashore.x, ashore.y)).toBe(near)
    // from y 0.5, a village at y INTERACT_DIST is exactly INTERACT_DIST away in floats
    const edge = village(15, INTERACT_DIST)
    expect(nearestVillage([edge], 15.5, 0.5)).toBe(edge)
    expect(nearestVillage([village(15, INTERACT_DIST + 0.01)], 15.5, 0.5)).toBeNull()
  })

  test('ships board within BOARD_DIST, picking the nearest index', () => {
    const ships: Ship[] = [{ x: 17, y: 3.5 }, { x: 16, y: 3.5 }, { x: 15.5, y: 3.5 + BOARD_DIST + 0.01 }]
    expect(nearestShipIndex(ships, ashore.x, ashore.y)).toBe(1)
    expect(nearestShipIndex([ships[2]], ashore.x, ashore.y)).toBe(-1)
    expect(target({ ships: [ships[2]] })).toBeNull()
  })

  test('standing at the Spain edge ashore does not sail home', () => {
    const west = halfMap(2)
    expect(target({ map: west, explorer: { x: 2.5, y: 3.5 } })).toBeNull()
  })
})

describe('sailing', () => {
  test('west of SPAIN_EDGE_X gives spain', () => {
    expect(target({ sailing: true, explorer: { x: SPAIN_EDGE_X - 0.5, y: 3.5 } })).toEqual({ kind: 'spain' })
  })

  test('spain beats landfall at the western edge', () => {
    const west = halfMap(SPAIN_EDGE_X)
    expect(target({ map: west, sailing: true, explorer: { x: SPAIN_EDGE_X - 0.5, y: 3.5 } })).toEqual({ kind: 'spain' })
  })

  test('away from land gives null', () => {
    expect(target({ sailing: true, explorer: { x: 7.5, y: 3.5 } })).toBeNull()
  })

  test('beside a landing spot gives landfall on the first spot', () => {
    // spots scan dy then dx from the top-left, so (12, 2) comes first
    expect(target({ sailing: true, explorer: { x: 11.5, y: 3.5 } })).toEqual({ kind: 'landfall', spot: [12, 2] })
  })

  test('villages, outposts and ships are never returned', () => {
    const here = { x: 7.5, y: 3.5 }
    const t = target({
      sailing: true,
      explorer: here,
      villages: [village(7, 3)],
      outposts: [{ x: 7, y: 3, stock: 99 }],
      ships: [{ x: 7.5, y: 3.5 }],
    })
    expect(t).toBeNull()
    const coast = { x: 11.5, y: 3.5 }
    const t2 = target({ sailing: true, explorer: coast, villages: [village(11, 3)], ships: [{ ...coast }] })
    expect(t2?.kind).toBe('landfall')
  })
})
