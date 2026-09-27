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

const seenSum = (f: { seen: Uint8Array }) => f.seen.reduce((a, b) => a + b, 0)

test('counts revealed tiles exactly, once each', () => {
  const f = makeFog(10, 10)
  reveal(f, 5, 5, 1) // the centre plus its four neighbours
  expect(f.revealedCount).toBe(5)
  reveal(f, 5, 5, 1)
  expect(f.revealedCount).toBe(5)
})

test('overlapping reveals keep the count equal to the seen tiles', () => {
  const f = makeFog(10, 10)
  reveal(f, 4, 4, 2)
  reveal(f, 6, 5, 2)
  reveal(f, 5, 5, 1)
  expect(f.revealedCount).toBe(seenSum(f))
})

test('a corner reveal clips to the map', () => {
  const f = makeFog(10, 10)
  reveal(f, 0, 0, 2)
  expect(f.revealedCount).toBe(seenSum(f))
  expect(f.seen.length).toBe(100)
})
