// Pure char-grid helpers only. src/art/spritebank.ts allocates canvases and
// must NOT be imported here — the suite runs without a DOM.
import { gridSize, shiftLegs, shiftRows, CELL, ANCHOR_X } from '../src/art/pixels'

test('mirror trick requires the anchor at the cell centre', () => {
  expect(ANCHOR_X).toBe(CELL / 2)
})

test('gridSize measures the longest row', () => {
  expect(gridSize(['..a', '.aaaa', 'a'])).toEqual([5, 3])
})

test('shiftLegs moves the near leg and leaves props outside the window alone', () => {
  //          col: 0123456789
  const rows = ['...MM.MM.p', '...bb.bb.p']
  const out = shiftLegs(rows, 0, 2, 8, 5, -1, 0, 0, 0)
  // near leg (cols 3,4) stepped one left; far leg and the pike at col 9 untouched
  expect(out).toEqual(['..MM..MM.p', '..bb..bb.p'])
})

test('shiftLegs clips at the window edge rather than spilling onto a prop', () => {
  const rows = ['...MM.MM.p']
  // window ends at col 8, so the far leg cannot be pushed onto the pike
  expect(shiftLegs(rows, 0, 2, 8, 5, 0, 0, 1, 0)).toEqual(['...MM..MMp'])
})

test('shiftLegs drops pixels pushed off the bottom, lifting the foot', () => {
  const rows = ['..MM......', '..bb......']
  const out = shiftLegs(rows, 0, 2, 6, 5, 0, -1, 0, 0)
  expect(out).toEqual(['..bb......', '..........'])
})

test('shiftRows heels only the requested band', () => {
  expect(shiftRows(['mm..', '..hh'], 0, 0, 1)).toEqual(['.mm.', '..hh'])
})
