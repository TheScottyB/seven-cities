import { makeState } from '../src/game/state'
import {
  canFound,
  foundOutpost,
  tickOutposts,
  resupply,
  OUTPOST_COST,
  OUTPOST_CREW,
  OUTPOST_MAX_STOCK,
  type Outpost,
} from '../src/game/outposts'

test('founding costs gold and garrison crew', () => {
  const s = makeState({ gold: 400, crew: 20 })
  const outposts: Outpost[] = []
  const o = foundOutpost(s, outposts, 50, 60)
  expect(o).not.toBeNull()
  expect(s.gold).toBe(400 - OUTPOST_COST)
  expect(s.crew).toBe(20 - OUTPOST_CREW)
  expect(outposts.length).toBe(1)
})

test('cannot found without gold or without men to spare', () => {
  expect(canFound(makeState({ gold: 100, crew: 20 }))).toBe(false)
  expect(canFound(makeState({ gold: 400, crew: OUTPOST_CREW + 1 }))).toBe(false)
  const s = makeState({ gold: 100, crew: 20 })
  expect(foundOutpost(s, [], 1, 1)).toBeNull()
  expect(s.gold).toBe(100)
})

test('outposts cannot crowd each other', () => {
  const s = makeState({ gold: 1000, crew: 30 })
  const outposts: Outpost[] = []
  expect(foundOutpost(s, outposts, 50, 50)).not.toBeNull()
  expect(foundOutpost(s, outposts, 54, 52)).toBeNull() // too close
  expect(foundOutpost(s, outposts, 80, 50)).not.toBeNull()
  expect(outposts.length).toBe(2)
})

test('stores grow over time and cap out', () => {
  const outposts: Outpost[] = [{ x: 0, y: 0, stock: 0 }]
  tickOutposts(outposts, 10)
  expect(outposts[0].stock).toBe(20)
  tickOutposts(outposts, 99999)
  expect(outposts[0].stock).toBe(OUTPOST_MAX_STOCK)
})

test('resupply moves the stores into the expedition larder', () => {
  const s = makeState({ food: 50 })
  const o: Outpost = { x: 0, y: 0, stock: 180.7 }
  const taken = resupply(s, o)
  expect(taken).toBe(180)
  expect(s.food).toBe(230)
  expect(o.stock).toBeLessThan(1)
})
