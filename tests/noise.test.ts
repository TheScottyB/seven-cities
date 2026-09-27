import { makeNoise2D } from '../src/world/noise'
import { makeRng } from '../src/world/rng'

test('deterministic for a seed', () => {
  const n1 = makeNoise2D(5),
    n2 = makeNoise2D(5)
  expect(n1(3.3, 7.1)).toBeCloseTo(n2(3.3, 7.1), 10)
})

test('output within [0,1], including negative and far-off coordinates', () => {
  const n = makeNoise2D(9)
  const r = makeRng(1)
  for (let i = 0; i < 2000; i++) {
    const v = n((r() - 0.5) * 5000, (r() - 0.5) * 5000)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  }
})

test('tiles seamlessly: the 256-cell lattice repeats every 2048 units at gridSize 8', () => {
  const n = makeNoise2D(9, 8)
  const r = makeRng(2)
  for (let i = 0; i < 200; i++) {
    const x = r() * 500
    const y = r() * 500
    expect(n(x + 2048, y)).toBeCloseTo(n(x, y), 6)
  }
})
