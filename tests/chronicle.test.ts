import {
  addEntry,
  bestScore,
  serializeChronicle,
  deserializeChronicle,
  CHRONICLE_MAX,
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
  expect(list.length).toBe(CHRONICLE_MAX)
  expect(list[0].score).toBe(19) // newest kept
})

test('the record run survives any number of lesser voyages', () => {
  let list = addEntry([], entry({ seedStr: 'best', score: 5000 }))
  for (let i = 0; i < 10; i++) {
    list = addEntry(list, entry({ seedStr: `n${i}`, score: i }))
    expect(list.length).toBeLessThanOrEqual(CHRONICLE_MAX)
    expect(list[0].seedStr).toBe(`n${i}`) // newest first
    expect(bestScore(list)).toBe(5000)
  }
  expect(list.filter((e) => e.seedStr === 'best').length).toBe(1)
})

test('a new record needs no special keeping', () => {
  let list: ChronicleEntry[] = []
  for (let i = 0; i < 12; i++) list = addEntry(list, entry({ score: i }))
  expect(list.map((e) => e.score)).toEqual([11, 10, 9, 8, 7, 6, 5, 4])
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

test('non-finite chronicle numbers (e.g. 1e999 -> Infinity) are dropped', () => {
  const raw = JSON.stringify([entry({ score: 123 }), entry({ score: 456 })]).replace('123', '1e999')
  const back = deserializeChronicle(raw)
  expect(back).toHaveLength(1)
  expect(back[0].score).toBe(456)
})

test('negative gold, day < 1, or negative cities are dropped while negative score is kept', () => {
  const json = JSON.stringify([
    entry({ score: -50, gold: 0, day: 1, cities: 0 }),
    entry({ gold: -1 }),
    entry({ day: 0 }),
    entry({ cities: -1 }),
  ])
  const back = deserializeChronicle(json)
  expect(back).toHaveLength(1)
  expect(back[0].score).toBe(-50)
})
