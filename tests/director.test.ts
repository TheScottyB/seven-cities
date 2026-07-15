import { direct, ambienceFor, type AudioSnapshot } from '../src/audio/director'

function snap(over: Partial<AudioSnapshot> = {}): AudioSnapshot {
  return {
    screen: 'playing',
    sailing: false,
    inStorm: false,
    onRiver: false,
    lowFood: false,
    citiesFound: 0,
    won: false,
    lost: false,
    ...over,
  }
}

const ids = (cues: { id: string }[]) => cues.map((c) => c.id)

test('nothing changed → no cues', () => {
  expect(direct(snap(), snap())).toEqual([])
})

test('ambience matches context', () => {
  expect(ambienceFor(snap())).toBe('amb-land')
  expect(ambienceFor(snap({ sailing: true }))).toBe('amb-sea')
  expect(ambienceFor(snap({ sailing: true, inStorm: true }))).toBe('amb-storm')
  expect(ambienceFor(snap({ onRiver: true }))).toBe('amb-river')
  expect(ambienceFor(snap({ screen: 'start' }))).toBe('amb-none')
  expect(ambienceFor(snap({ screen: 'walkin' }))).toBe('amb-land')
})

test('ambience cue fires only on change', () => {
  const land = snap()
  const sea = snap({ sailing: true })
  expect(ids(direct(land, sea))).toContain('amb-sea')
  expect(ids(direct(sea, sea))).not.toContain('amb-sea')
})

test('boarding and landfall are one-shots', () => {
  expect(ids(direct(snap(), snap({ sailing: true })))).toContain('board')
  expect(ids(direct(snap({ sailing: true }), snap()))).toContain('landfall')
})

test('sailing into a storm howls exactly once', () => {
  const calm = snap({ sailing: true })
  const storm = snap({ sailing: true, inStorm: true })
  expect(ids(direct(calm, storm))).toContain('storm-enter')
  expect(ids(direct(storm, storm))).not.toContain('storm-enter')
})

test('discoveries and endings ring out', () => {
  expect(ids(direct(snap(), snap({ citiesFound: 1 })))).toContain('city-found')
  expect(ids(direct(snap(), snap({ won: true })))).toContain('victory')
  expect(ids(direct(snap(), snap({ lost: true })))).toContain('defeat')
})

test('the larder bell rings once when food runs low, re-arms on recovery', () => {
  const fed = snap()
  const hungry = snap({ lowFood: true })
  expect(ids(direct(fed, hungry))).toContain('low-food')
  expect(ids(direct(hungry, hungry))).not.toContain('low-food')
  expect(ids(direct(hungry, fed))).not.toContain('low-food')
  expect(ids(direct(fed, hungry))).toContain('low-food') // recovered, dropped again
})

test('coming home to Spain rings out', () => {
  expect(ids(direct(snap({ sailing: true }), snap({ screen: 'spain', sailing: true })))).toContain('home')
})

test('walk-in entry cues, and explicit events pass through', () => {
  expect(ids(direct(snap(), snap({ screen: 'walkin' })))).toContain('walkin-enter')
  expect(ids(direct(snap(), snap(), ['trade']))).toContain('trade')
  expect(ids(direct(snap(), snap(), ['attack', 'driven-off']))).toEqual(
    expect.arrayContaining(['attack', 'driven-off']),
  )
})
