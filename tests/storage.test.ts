import {
  SAVE_KEY,
  CHRONICLE_KEY,
  OWNER_KEY,
  AUDIO_KEY,
  loadMuted,
  storeMuted,
  announceOwner,
  writeSave,
  loadSave,
  unreadableSave,
  removeSave,
  loadChronicle,
  appendChronicle,
  type SaveInput,
} from '../src/app/storage'
import { makeState } from '../src/game/state'
import type { ChronicleEntry } from '../src/game/chronicle'

/** An in-memory Storage; `fail` makes the named methods throw like a blocked or full browser store. */
function memoryStorage(fail: { get?: Error; set?: Error; remove?: Error } = {}): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    get length() {
      return data.size
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    clear: () => data.clear(),
    getItem: (k: string) => {
      if (fail.get) throw fail.get
      return data.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (fail.set) throw fail.set
      data.set(k, String(v))
    },
    removeItem: (k: string) => {
      if (fail.remove) throw fail.remove
      data.delete(k)
    },
  }
}

const blocked = () => new DOMException('The operation is insecure.', 'SecurityError')
const quota = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError')

function saveInput(): SaveInput {
  const fogSeen = new Uint8Array(64)
  fogSeen[3] = 1
  return {
    seedStr: '1492',
    mapHash: 12345,
    phase: 'at-sea',
    state: makeState({ gold: 40 }),
    explorer: { x: 10.5, y: 20.5 },
    ships: [{ x: 9.5, y: 20.5 }],
    activeShip: 0,
    sailing: false,
    career: { banked: 300, voyages: 1 },
    outposts: [],
    fogSeen,
    villages: [],
  }
}

const entry = (seedStr: string, score: number): ChronicleEntry => ({ seedStr, won: false, score, gold: 1, day: 2, cities: 0 })

test('the storage key names are the shipped ones', () => {
  expect([SAVE_KEY, CHRONICLE_KEY, OWNER_KEY, AUDIO_KEY]).toEqual([
    'seven-cities-save',
    'seven-cities-chronicle',
    'seven-cities-save-owner',
    'seven-cities-audio',
  ])
})

test('the save round-trips and removes', () => {
  const store = memoryStorage()
  expect(loadSave(store)).toBeNull()
  expect(unreadableSave(store)).toBe(false)
  expect(writeSave(saveInput(), store)).toBe(true)
  const back = loadSave(store)!
  expect(back.seedStr).toBe('1492')
  expect(back.state).toEqual(makeState({ gold: 40 }))
  expect(back.explorer).toEqual({ x: 10.5, y: 20.5 })
  expect(back.career).toEqual({ banked: 300, voyages: 1 })
  expect(unreadableSave(store)).toBe(false)
  removeSave(store)
  expect(store.data.has(SAVE_KEY)).toBe(false)
  expect(loadSave(store)).toBeNull()
})

test('a damaged or foreign save is unreadable, and loads as nothing', () => {
  const store = memoryStorage()
  store.data.set(SAVE_KEY, '{"version":3}')
  expect(unreadableSave(store)).toBe(true)
  expect(loadSave(store)).toBeNull()
  store.data.set(SAVE_KEY, '')
  expect(unreadableSave(store)).toBe(false)
})

test('the mute choice round-trips as JSON', () => {
  const store = memoryStorage()
  expect(loadMuted(store)).toBe(false)
  storeMuted(true, store)
  expect(store.data.get(AUDIO_KEY)).toBe('true')
  expect(loadMuted(store)).toBe(true)
  storeMuted(false, store)
  expect(store.data.get(AUDIO_KEY)).toBe('false')
  expect(loadMuted(store)).toBe(false)
})

test('the chronicle appends newest first and survives garbage', () => {
  const store = memoryStorage()
  expect(loadChronicle(store)).toEqual([])
  appendChronicle(entry('a', 10), store)
  appendChronicle(entry('b', 20), store)
  expect(loadChronicle(store).map((e) => e.seedStr)).toEqual(['b', 'a'])
  store.data.set(CHRONICLE_KEY, 'not json')
  expect(loadChronicle(store)).toEqual([])
  appendChronicle(entry('c', 5), store)
  expect(loadChronicle(store).map((e) => e.seedStr)).toEqual(['c'])
})

test('each owner claim writes a fresh token', () => {
  const store = memoryStorage()
  announceOwner(store)
  const first = store.data.get(OWNER_KEY)
  expect(first).toMatch(/^\d+-/)
  announceOwner(store)
  expect(store.data.get(OWNER_KEY)).not.toBe(first)
})

test('blocked storage falls back quietly: nothing throws, reads come back empty', () => {
  const store = memoryStorage({ get: blocked(), set: blocked(), remove: blocked() })
  expect(loadMuted(store)).toBe(false)
  expect(() => storeMuted(true, store)).not.toThrow()
  expect(() => announceOwner(store)).not.toThrow()
  expect(writeSave(saveInput(), store)).toBe(false)
  expect(loadSave(store)).toBeNull()
  expect(unreadableSave(store)).toBe(false)
  expect(() => removeSave(store)).not.toThrow()
  expect(loadChronicle(store)).toEqual([])
  expect(() => appendChronicle(entry('a', 1), store)).not.toThrow()
})

test('a full store surfaces as false from writeSave and keeps the last good save', () => {
  const store = memoryStorage()
  expect(writeSave(saveInput(), store)).toBe(true)
  appendChronicle(entry('a', 1), store)
  const full = Object.assign(store, {
    setItem: () => {
      throw quota()
    },
  })
  const later = { ...saveInput(), seedStr: '1493' }
  expect(writeSave(later, full)).toBe(false)
  expect(loadSave(full)!.seedStr).toBe('1492')
  expect(() => appendChronicle(entry('b', 2), full)).not.toThrow()
  expect(loadChronicle(full).map((e) => e.seedStr)).toEqual(['a'])
  expect(() => storeMuted(true, full)).not.toThrow()
})

describe('with no store passed', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete (globalThis as { localStorage?: Storage }).localStorage
  })

  test('globalThis.localStorage is used', () => {
    const store = memoryStorage()
    Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true })
    expect(writeSave(saveInput())).toBe(true)
    expect(store.data.has(SAVE_KEY)).toBe(true)
    expect(loadSave()!.seedStr).toBe('1492')
    storeMuted(true)
    expect(loadMuted()).toBe(true)
  })

  test('a browser that throws on reading localStorage itself gets the same fallbacks', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw blocked()
      },
      configurable: true,
    })
    expect(loadMuted()).toBe(false)
    expect(() => storeMuted(true)).not.toThrow()
    expect(() => announceOwner()).not.toThrow()
    expect(writeSave(saveInput())).toBe(false)
    expect(loadSave()).toBeNull()
    expect(unreadableSave()).toBe(false)
    expect(() => removeSave()).not.toThrow()
    expect(loadChronicle()).toEqual([])
    expect(() => appendChronicle(entry('a', 1))).not.toThrow()
  })
})
