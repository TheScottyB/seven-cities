/**
 * Pure narrative & 1984-style expedition lore: settlement names, compass
 * rumors, milestone toasts, and Royal Court commentary. DOM-free so every
 * line and bearing calculation is unit-testable in Node.
 */
import { tileHash } from '../world/rng'
import { CITIES_OF_GOLD, type Village } from '../world/villages'
import type { Career } from './career'

/** The seven fabled metropolises — each certified genuine gold-tone alloy. */
export const GOLDEN_CITY_NAMES = [
  'Cibola (14k Gold-Tone)',
  'El Dorado (Electro-Plated)',
  'Quivira (Genuine Brass-Finish)',
  'Paititi (Six-Seven Annex)',
  'Ophir (Guaranteed Almost-Gold)',
  'Chicora (Polished Pyrite Plaza)',
  'Norumbega (Certified Gold-Tone)',
] as const satisfies readonly string[]

const VILLAGE_NAMES = [
  'Tlacopan',
  'Shrubbery-on-the-Marsh',
  'Cholula',
  'New Camelot (Silly Place)',
  'Mayapan',
  'Swamp Castle',
  'Xochimilco',
  'Ni-Coztlan',
  'Tzintzuntzan',
  'Quetzal-67',
  'Cempoala',
  'Gorge of Mild Peril',
  'Texcoco',
  'Aztlan-on-Thames',
  'Uxmal',
  'Ministry of Silly Walks',
  'Copan',
  'Palenque-on-Sea',
  'Tikal',
  'Lumberjack Landing',
] as const

const COMPASS_WINDS = [
  'EAST',
  'SOUTHEAST',
  'SOUTH',
  'SOUTHWEST',
  'WEST',
  'NORTHWEST',
  'NORTH',
  'NORTHEAST',
] as const

export type CompassWind = (typeof COMPASS_WINDS)[number]

/** Deterministic name for a settlement; golden cities take the seven fabled titles. */
export function villageName(v: Village, villages: readonly Village[]): string {
  if (v.golden) {
    const golden = villages.filter((u) => u.golden)
    const idx = golden.indexOf(v)
    return GOLDEN_CITY_NAMES[(idx >= 0 ? idx : tileHash(v.x, v.y)) % GOLDEN_CITY_NAMES.length]
  }
  return VILLAGE_NAMES[tileHash(v.x, v.y) % VILLAGE_NAMES.length]
}

/** 8-wind compass bearing and rough league distance from (fromX, fromY) to (toX, toY). */
export function bearingAndLeagues(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { wind: CompassWind; leagues: number } {
  const dx = toX - fromX
  const dy = toY - fromY
  const ang = Math.atan2(dy, dx) // 0 = east, +pi/2 = south (canvas Y grows down)
  const sector = Math.round(ang / (Math.PI / 4))
  const wind = COMPASS_WINDS[((sector % 8) + 8) % 8]
  const leagues = Math.max(1, Math.round(Math.hypot(dx, dy) * 1.5))
  return { wind, leagues }
}

/** Classic 1984 chief's rumor: compass direction + distance + dry aside. */
export function rumorLine(from: { x: number; y: number }, target: { x: number; y: number }): string {
  const { wind, leagues } = bearingAndLeagues(from.x, from.y, target.x, target.y)
  return `The elders point ${wind} (~${leagues} leagues) — "about six or seven hills past the shrubbery."`
}

/** Discovery toast for a City of Gold, celebrating the 6-7 milestone. */
export function cityFoundToast(name: string, found: number): string {
  if (found >= CITIES_OF_GOLD) {
    return `SIX-SEVEN! ${name} — all ${CITIES_OF_GOLD} Cities of Gold-Tone Metal found!`
  }
  if (found === CITIES_OF_GOLD - 1) {
    return `6... 7! ${name} (${found}/${CITIES_OF_GOLD}) — just one brass metropolis left!`
  }
  return `${name} — ${found} of ${CITIES_OF_GOLD} Cities of Gold-Tone found!`
}

/** Dry royal commentary from the Spanish Court on returning home. */
export function courtRemark(career: Career, justBanked: number, promoted: boolean): string {
  if (promoted) {
    return 'The Royal Assayer bites a coin. "Solid 6 out of 7. Definitely gold-tone. Elevate them!"'
  }
  if (justBanked <= 0) {
    return '"You brought back zero gold-tone? Nobody expects an empty hold. Try a shrubbery next time."'
  }
  if (career.voyages === 1) {
    return 'Nobody expects the Spanish Re-Outfitting! The Crown inspects your shiny alloy.'
  }
  return '"On second thought, let\'s not stay in Palos. \'Tis a silly place." — The Crown'
}
