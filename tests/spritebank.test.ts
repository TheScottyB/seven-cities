// The draw calls are exercised against a fake bank and a stub context:
// buildSpriteBank needs a DOM, but importing the module does not.
import { drawExplorerSprite, drawShipSprite, gaitFrameIndex, type SpriteBank } from '../src/art/spritebank'
import { CELL } from '../src/art/pixels'
import { Facing, GAIT_CYCLE } from '../src/game/gait'

const cell = (name: string) => ({ name }) as unknown as HTMLCanvasElement

function fakeBank(): SpriteBank {
  const facings = ['S', 'W', 'E', 'N']
  return {
    explorer: facings.map((f) => [0, 1, 2, 3].map((i) => cell(`fig-${f}${i}`))),
    ship: facings.map((f) => [cell(`ship-${f}0`), cell(`ship-${f}1`)]),
    anchor: { x: 12, explorerY: 20, shipY: 18 },
    cell: CELL,
  }
}

function stubCtx() {
  const drawImage = vi.fn()
  return { g: { drawImage } as unknown as CanvasRenderingContext2D, drawImage }
}

test('gait 0 is the neutral frame, and the gait wrap lands back on it', () => {
  expect(gaitFrameIndex(0)).toBe(0)
  expect(gaitFrameIndex(GAIT_CYCLE)).toBe(gaitFrameIndex(0))
  expect(gaitFrameIndex(-3.7)).toBe(0)
})

test('facing west does not shift the conquistador sideways', () => {
  // The west cell is the east cell flipped about the cell centre, so art at
  // columns [a, a + w) lands at [CELL - a - w, CELL - a). The figure is 11 px
  // wide at column 6 (spritebank FIG_W / FIG_X).
  const figX = 6
  const figW = 11
  const bank = fakeBank()
  const { g, drawImage } = stubCtx()
  drawExplorerSprite(g, bank, 40.3, 30, Facing.E)
  drawExplorerSprite(g, bank, 40.3, 30, Facing.W)
  const [eCell, xE, yE] = drawImage.mock.calls[0]
  const [wCell, xW, yW] = drawImage.mock.calls[1]
  expect(eCell).toBe(bank.explorer[Facing.E][0])
  expect(wCell).toBe(bank.explorer[Facing.W][0])
  expect(xW + (CELL - figX - figW)).toBe(xE + figX) // left edge of the art
  expect(yW).toBe(yE)
})

test('a ship with no facing and no clock draws the still east cell', () => {
  const bank = fakeBank()
  const { g, drawImage } = stubCtx()
  drawShipSprite(g, bank, 0, 0, undefined)
  expect(drawImage).toHaveBeenCalledTimes(1)
  expect(drawImage.mock.calls[0][0]).toBe(bank.ship[Facing.E][0])
  expect(drawImage.mock.calls[0].slice(1)).toEqual([-12, -18])
})
