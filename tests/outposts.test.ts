import { makeState } from '../src/game/state'
import {
  canFound,
  foundOutpost,
  tooCloseToVillage,
  tickOutposts,
  resupply,
  OUTPOST_COST,
  OUTPOST_CREW,
  OUTPOST_MAX_STOCK,
  OUTPOST_MIN_CREW,
  type Outpost,
} from '../src/game/outposts'

test('founding costs gold and garrison crew and eases local fear', () => {
  const s = makeState({ gold: 400, crew: 20, fear: 10 })
  const outposts: Outpost[] = []
  const o = foundOutpost(s, outposts, 50, 60)
  expect(o).not.toBeNull()
  expect(s.gold).toBe(400 - OUTPOST_COST)
  expect(s.crew).toBe(20 - OUTPOST_CREW)
  expect(s.fear).toBe(6)
  expect(outposts.length).toBe(1)
})

test('cannot found without gold or without men to spare', () => {
  expect(canFound(makeState({ gold: 100, crew: 20 }))).toBe(false)
  expect(canFound(makeState({ gold: 400, crew: OUTPOST_MIN_CREW - 1 }))).toBe(false)
  expect(canFound(makeState({ gold: 400, crew: OUTPOST_MIN_CREW }))).toBe(true)
  expect(OUTPOST_MIN_CREW).toBeGreaterThan(OUTPOST_CREW)
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
  expect(outposts[0].stock).toBe(20) // tripwire on OUTPOST_REGEN (2/s): a retune must be deliberate
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

test('outposts keep off a village doorstep; exactly the radius is allowed', () => {
  const villages = [{ x: 10, y: 10 }]
  expect(tooCloseToVillage(villages, 14, 10)).toBe(false)
  expect(tooCloseToVillage(villages, 13.99, 10)).toBe(true)
  expect(tooCloseToVillage(villages, 10, 10)).toBe(true)
  expect(tooCloseToVillage([], 10, 10)).toBe(false)
  expect(tooCloseToVillage(villages, 16, 10, 7)).toBe(true)
})
