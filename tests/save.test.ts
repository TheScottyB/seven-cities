import { packBits, unpackBits, serializeSave, deserializeSave } from '../src/game/save'
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
  expect(deserializeSave('{"version": 6}')).toBeNull() // missing fields
  expect(deserializeSave('null')).toBeNull()
  // pre-river saves (v1/v2) reference maps that no longer generate the same;
  // both are rejected cleanly
  expect(deserializeSave('{"version": 1, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
  expect(deserializeSave('{"version": 2, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
  expect(deserializeSave('{"version": 3, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
  expect(deserializeSave('{"version": 4, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
  expect(deserializeSave('{"version": 5, "seedStr": "x", "fogSeenB64": ""}')).toBeNull()
})
