import { makeFog, reveal, isSeen } from '../src/world/fog'

test('starts fully unseen', () => {
  const f = makeFog(10, 10)
  expect(isSeen(f, 5, 5)).toBe(false)
})

test('reveal marks a radius seen and it persists', () => {
  const f = makeFog(10, 10)
  reveal(f, 5, 5, 2)
  expect(isSeen(f, 5, 5)).toBe(true)
  expect(isSeen(f, 6, 5)).toBe(true)
  expect(isSeen(f, 9, 9)).toBe(false)
  reveal(f, 0, 0, 1)
  expect(isSeen(f, 5, 5)).toBe(true)
})

test('counts revealed tiles', () => {
  const f = makeFog(10, 10)
  reveal(f, 5, 5, 1)
  expect(f.revealedCount).toBeGreaterThan(0)
})
