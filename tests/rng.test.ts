import { makeRng, seedFromString, tileHash } from '../src/world/rng'

test('same seed produces identical sequence', () => {
  const a = makeRng(42),
    b = makeRng(42)
  expect([a(), a(), a()]).toEqual([b(), b(), b()])
})

test('different seeds diverge', () => {
  const a = makeRng(1),
    b = makeRng(2)
  expect(a()).not.toEqual(b())
})

test('output is in [0,1)', () => {
  const r = makeRng(7)
  for (let i = 0; i < 100; i++) {
    const v = r()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
  }
})

test('seedFromString is deterministic and differs by input', () => {
  expect(seedFromString('1492')).toBe(seedFromString('1492'))
  expect(seedFromString('1492')).not.toBe(seedFromString('1493'))
})

test('tileHash returns an unsigned 32-bit deterministic hash', () => {
  expect(tileHash(12, 34)).toBe(tileHash(12, 34))
  expect(tileHash(12, 34)).not.toBe(tileHash(34, 12))
  expect(tileHash(-5, 99)).toBeGreaterThanOrEqual(0)
  expect(tileHash(-5, 99)).toBeLessThan(2 ** 32)
})
