import { packBits, unpackBits, serializeSave, deserializeSave, mapFingerprint, SAVE_VERSION } from '../src/game/save'
import { makeState } from '../src/game/state'
import { generateMap } from '../src/world/mapgen'
import { placeVillages } from '../src/world/villages'
import { makeFog, reveal } from '../src/world/fog'

test('packBits/unpackBits round-trip', () => {
  const bits = new Uint8Array(100)
  for (let i = 0; i < bits.length; i += 3) bits[i] = 1
  const packed = packBits(bits)
  expect(Array.from(unpackBits(packed, bits.length))).toEqual(Array.from(bits))
})

test('save round-trips the full expedition', () => {
  const map = generateMap(123)
  const villages = placeVillages(map, 28)
  const fog = makeFog(map.width, map.height)
  reveal(fog, 50, 60, 7)
  const state = makeState({ gold: 123, goods: 42, citiesFound: 2 })
  villages[3].visited = true
  villages[3].depleted = true

  const json = serializeSave({
    seedStr: '1492',
    mapHash: mapFingerprint(map.tiles, map.width, map.height, villages),
    phase: 'refit',
    state,
    explorer: { x: 50.5, y: 60.25 },
    ships: [{ x: 48.5, y: 61.5 }, { x: 47.5, y: 61.5 }],
    activeShip: 1,
    sailing: true,
    career: { banked: 2500, voyages: 2 },
    outposts: [{ x: 90, y: 90, stock: 120 }],
    fogSeen: fog.seen,
    villages,
  })
  const back = deserializeSave(json)!
  expect(back).not.toBeNull()
  expect(back.seedStr).toBe('1492')
  expect(back.mapHash).toBe(mapFingerprint(map.tiles, map.width, map.height, villages))
  expect(back.phase).toBe('refit')
  expect(back.state).toEqual(state)
  expect(back.explorer).toEqual({ x: 50.5, y: 60.25 })
  expect(back.ships).toEqual([{ x: 48.5, y: 61.5 }, { x: 47.5, y: 61.5 }])
  expect(back.activeShip).toBe(1)
  expect(back.sailing).toBe(true)
  expect(back.outposts).toEqual([{ x: 90, y: 90, stock: 120 }])
  expect(back.career).toEqual({ banked: 2500, voyages: 2 })
  expect(Array.from(unpackBits(back.fogSeenB64, fog.seen.length))).toEqual(Array.from(fog.seen))
  expect(back.villages).toEqual(villages)
})

test('garbage and wrong versions are rejected', () => {
  expect(deserializeSave('not json {{{')).toBeNull()
  expect(deserializeSave('{"version": 99}')).toBeNull()
  expect(deserializeSave('{"version": 7}')).toBeNull() // missing fields
  expect(deserializeSave('null')).toBeNull()
  // pre-river saves (v1/v2) reference maps that no longer generate the same;
  // both are rejected cleanly
  expect(deserializeSave('{"version": 1, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
  expect(deserializeSave('{"version": 2, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
  expect(deserializeSave('{"version": 3, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
  expect(deserializeSave('{"version": 4, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
  expect(deserializeSave('{"version": 5, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
  expect(deserializeSave('{"version": 6, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
})

// The frozen v7 baseline: must keep deserializing forever. If the format
// changes, bump SAVE_VERSION and upgrade this in deserializeSave; never edit it.
const FROZEN_V7 =
  '{"version":7,"seedStr":"1492","mapHash":2166136261,"phase":"at-sea","state":{"food":212.5,"crew":24,"gold":130,"goods":60,"morale":88,"fear":10,"day":4,"elapsed":71.25,"citiesFound":1,"villagesContacted":2,"status":0},"explorer":{"x":50.5,"y":60.25},"ships":[{"x":48.5,"y":61.5},{"x":47.5,"y":61.5}],"activeShip":1,"sailing":false,"career":{"banked":600,"voyages":1},"outposts":[{"x":90,"y":90,"stock":120}],"fogSeenB64":"BwYC","villages":[{"x":12,"y":34,"wealth":640,"temperament":0.75,"population":180,"golden":true,"visited":true,"depleted":false},{"x":40,"y":8,"wealth":90,"temperament":0.2,"population":60,"golden":false,"visited":true,"depleted":true}]}'

test('the frozen v7 save deserializes', () => {
  const back = deserializeSave(FROZEN_V7)
  expect(back).not.toBeNull()
  expect(back!.version).toBe(SAVE_VERSION)
  expect(back!.phase).toBe('at-sea')
  expect(back!.mapHash).toBe(2166136261)
  expect(back!.state.crew).toBe(24)
  expect(back!.activeShip).toBe(1)
  expect(back!.villages).toHaveLength(2)
  expect(Array.from(unpackBits(back!.fogSeenB64, 20))).toEqual(
    [1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  )
})

function validSave(): Record<string, unknown> {
  const state = makeState({ gold: 50 })
  return JSON.parse(
    serializeSave({
      seedStr: '7',
      mapHash: 12345,
      phase: 'at-sea',
      state,
      explorer: { x: 10.5, y: 11.5 },
      ships: [{ x: 9.5, y: 11.5 }],
      activeShip: 0,
      sailing: false,
      career: { banked: 0, voyages: 0 },
      outposts: [],
      fogSeen: new Uint8Array(16),
      villages: [],
    }),
  )
}

test('the mutation baseline is itself valid', () => {
  expect(deserializeSave(JSON.stringify(validSave()))).not.toBeNull()
})

type Mutation = [string, (d: Record<string, any>) => void]
const mutations: Mutation[] = [
  ['no ships', (d) => { d.ships = [] }],
  ['too many ships', (d) => { d.ships = Array.from({ length: 5 }, () => ({ x: 1, y: 1 })) }],
  ['activeShip -1', (d) => { d.activeShip = -1 }],
  ['activeShip 0.5', (d) => { d.activeShip = 0.5 }],
  ['activeShip past the fleet', (d) => { d.activeShip = 1 }],
  ['crew deleted', (d) => { delete d.state.crew }],
  ['morale "x"', (d) => { d.state.morale = 'x' }],
  ['elapsed null (NaN round-trips as null)', (d) => { d.state.elapsed = null }],
  ['status 99', (d) => { d.state.status = 99 }],
  ['version 6', (d) => { d.version = 6 }],
  ['explorer x null', (d) => { d.explorer.x = null }],
  ['ship y missing', (d) => { delete d.ships[0].y }],
  ['phase unknown', (d) => { d.phase = 'docked' }],
  ['mapHash missing', (d) => { delete d.mapHash }],
  ['fog that is not base64', (d) => { d.fogSeenB64 = 'not base64!' }],
  ['a null village entry', (d) => { d.villages = [null] }],
  ['a village entry that is a number', (d) => { d.villages = [3] }],
  ['an outpost without stock', (d) => { d.outposts = [{ x: 1, y: 1 }] }],
  ['a null outpost', (d) => { d.outposts = [null] }],
]

test('rejects banked gold past the float range, which JSON.parse turns into Infinity', () => {
  const json = JSON.stringify(validSave()).replace('"banked":0', '"banked":1e999')
  expect(json).toContain('1e999')
  expect(deserializeSave(json)).toBeNull()
})

test('populated village and outpost entries still load', () => {
  const d = validSave()
  d.villages = [{ visited: true, depleted: false, temperament: 0.5 }, {}]
  d.outposts = [{ x: 3, y: 4, stock: 12 }]
  expect(deserializeSave(JSON.stringify(d))).not.toBeNull()
})

test.each(mutations)('rejects a save with %s', (_name, mutate) => {
  const d = validSave()
  mutate(d)
  expect(deserializeSave(JSON.stringify(d))).toBeNull()
})

test('mapFingerprint is deterministic and sees tiles and golden cities', () => {
  const map = generateMap(99)
  const villages = placeVillages(map, 28)
  const h = mapFingerprint(map.tiles, map.width, map.height, villages)
  expect(mapFingerprint(generateMap(99).tiles, map.width, map.height, placeVillages(generateMap(99), 28))).toBe(h)

  const tiles = map.tiles.slice()
  tiles[1234] = tiles[1234] === 0 ? 1 : 0
  expect(mapFingerprint(tiles, map.width, map.height, villages)).not.toBe(h)

  const flipped = villages.map((v, i) => (i === 5 ? { ...v, golden: !v.golden } : v))
  expect(mapFingerprint(map.tiles, map.width, map.height, flipped)).not.toBe(h)
})
