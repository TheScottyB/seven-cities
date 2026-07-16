import { describe, expect, it } from 'vitest'
import { sceneControls, type SceneInput } from '../src/audio/scene'

const base: SceneInput = {
  screen: 'playing',
  sailing: false,
  inStorm: false,
  wind: 0,
  distToLand: 0,
  hostility: 0,
  famine: 0,
}
const at = (over: Partial<SceneInput>) => sceneControls({ ...base, ...over })

describe('the ship speaks to the weather', () => {
  it('a calm sea still creaks a little, but the rigging stays quiet', () => {
    const calm = at({ sailing: true, wind: 0.1, distToLand: Infinity })
    expect(calm.creaksPerMin).toBeGreaterThan(0)
    expect(calm.clangsPerMin).toBe(0)
  })

  it('wind and storm multiply the groaning and set the iron clanging', () => {
    const calm = at({ sailing: true, wind: 0.15, distToLand: Infinity })
    const gale = at({ sailing: true, wind: 0.9, distToLand: Infinity })
    const storm = at({ sailing: true, wind: 0.9, inStorm: true, distToLand: Infinity })
    expect(gale.creaksPerMin).toBeGreaterThan(calm.creaksPerMin)
    expect(gale.clangsPerMin).toBeGreaterThan(0)
    expect(storm.creaksPerMin).toBeGreaterThan(gale.creaksPerMin)
    expect(storm.clangsPerMin).toBeGreaterThan(gale.clangsPerMin)
  })

  it('waves swell harder as the wind rises', () => {
    const calm = at({ sailing: true, wind: 0.1, distToLand: Infinity })
    const gale = at({ sailing: true, wind: 0.9, distToLand: Infinity })
    expect(gale.swellsPerMin).toBeGreaterThan(calm.swellsPerMin)
    expect(gale.swellGain).toBeGreaterThan(calm.swellGain)
  })

  it('gulls are silent in open ocean and grow insistent near the coast', () => {
    expect(at({ sailing: true, distToLand: Infinity }).gullsPerMin).toBe(0)
    expect(at({ sailing: true, distToLand: 13 }).gullsPerMin).toBe(0)
    const far = at({ sailing: true, distToLand: 9 }).gullsPerMin
    const close = at({ sailing: true, distToLand: 2 }).gullsPerMin
    expect(far).toBeGreaterThan(0)
    expect(close).toBeGreaterThan(far)
  })

  it('ship textures stay aboard the ship', () => {
    const ashore = at({ sailing: false })
    expect(ashore.creaksPerMin).toBe(0)
    expect(ashore.clangsPerMin).toBe(0)
    expect(ashore.gullsPerMin).toBe(0)
    expect(ashore.swellsPerMin).toBe(0)
  })
})

describe('the land drone leans into danger', () => {
  it('safe country hums low, bright, and pulseless', () => {
    const safe = at({})
    expect(safe.padNotesPerMin).toBeGreaterThan(0)
    expect(safe.padDark).toBe(0)
    expect(safe.pulsesPerMin).toBe(0)
  })

  it('approaching hostiles darken and quicken the drone and start the pulse', () => {
    const safe = at({})
    const tense = at({ hostility: 0.9 })
    expect(tense.padNotesPerMin).toBeGreaterThan(safe.padNotesPerMin)
    expect(tense.padDark).toBeGreaterThan(0.5)
    expect(tense.pulsesPerMin).toBeGreaterThan(0)
    expect(tense.pulseGain).toBeGreaterThan(safe.pulseGain)
  })

  it('famine counts as danger too, and the walk-in scene keeps the drone', () => {
    expect(at({ famine: 1 }).danger).toBeGreaterThan(0.5)
    expect(at({ screen: 'walkin', hostility: 1 }).pulsesPerMin).toBeGreaterThan(0)
  })

  it('menus and the title are silent country', () => {
    for (const screen of ['start', 'outfit', 'spain', 'over']) {
      const c = at({ screen, hostility: 1, famine: 1 })
      expect(c.padNotesPerMin).toBe(0)
      expect(c.creaksPerMin).toBe(0)
      expect(c.pulsesPerMin).toBe(0)
    }
  })
})
