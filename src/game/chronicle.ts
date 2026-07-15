/**
 * The Chronicle: a persistent record of past expeditions, shown on the title
 * screen. Pure data logic — storage happens in main.ts via localStorage.
 */
export interface ChronicleEntry {
  seedStr: string
  won: boolean
  score: number
  gold: number
  day: number
  cities: number
}

export const CHRONICLE_MAX = 8

/** Newest first, capped. */
export function addEntry(list: ChronicleEntry[], e: ChronicleEntry, max = CHRONICLE_MAX): ChronicleEntry[] {
  return [e, ...list].slice(0, max)
}

export function bestScore(list: ChronicleEntry[]): number | null {
  if (!list.length) return null
  return list.reduce((a, e) => Math.max(a, e.score), -Infinity)
}

export function serializeChronicle(list: ChronicleEntry[]): string {
  return JSON.stringify(list)
}

export function deserializeChronicle(json: string): ChronicleEntry[] {
  try {
    const d = JSON.parse(json)
    if (!Array.isArray(d)) return []
    return d.filter(
      (e): e is ChronicleEntry =>
        !!e &&
        typeof e.seedStr === 'string' &&
        typeof e.won === 'boolean' &&
        typeof e.score === 'number' &&
        typeof e.gold === 'number' &&
        typeof e.day === 'number' &&
        typeof e.cities === 'number',
    )
  } catch {
    return []
  }
}
