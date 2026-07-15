import {
  addEntry,
  bestScore,
  serializeChronicle,
  deserializeChronicle,
  type ChronicleEntry,
} from '../src/game/chronicle'

function entry(over: Partial<ChronicleEntry> = {}): ChronicleEntry {
  return { seedStr: '12', won: true, score: 1000, gold: 500, day: 20, cities: 7, ...over }
}

test('newest entry goes first', () => {
  const list = addEntry(addEntry([], entry({ score: 1 })), entry({ score: 2 }))
  expect(list[0].score).toBe(2)
  expect(list[1].score).toBe(1)
})

test('chronicle is capped', () => {
  let list: ChronicleEntry[] = []
  for (let i = 0; i < 20; i++) list = addEntry(list, entry({ score: i }))
  expect(list.length).toBe(8)
  expect(list[0].score).toBe(19) // newest kept
})

test('bestScore across entries; null when empty', () => {
  expect(bestScore([])).toBeNull()
  const list = [entry({ score: 3 }), entry({ score: 9 }), entry({ score: 5 })]
  expect(bestScore(list)).toBe(9)
})

test('round-trips through serialization', () => {
  const list = [entry({ won: false, score: -20 }), entry()]
  expect(deserializeChronicle(serializeChronicle(list))).toEqual(list)
})

test('garbage deserializes to an empty chronicle', () => {
  expect(deserializeChronicle('nope{{{')).toEqual([])
  expect(deserializeChronicle('{"a":1}')).toEqual([])
  expect(deserializeChronicle('null')).toEqual([])
})

test('invalid entries are dropped, valid kept', () => {
  const json = JSON.stringify([entry(), { bogus: true }, entry({ score: 7 })])
  const back = deserializeChronicle(json)
  expect(back.length).toBe(2)
  expect(back[1].score).toBe(7)
})
