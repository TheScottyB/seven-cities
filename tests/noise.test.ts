import { makeNoise2D } from '../src/world/noise'

test('deterministic for a seed', () => {
  const n1 = makeNoise2D(5),
    n2 = makeNoise2D(5)
  expect(n1(3.3, 7.1)).toBeCloseTo(n2(3.3, 7.1), 10)
})

test('output within [0,1]', () => {
  const n = makeNoise2D(9)
  for (let i = 0; i < 200; i++) {
    const v = n(Math.random() * 50, Math.random() * 50)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  }
})
