/**
 * The Chronicle: a persistent record of past expeditions, shown on the title
 * screen. Pure data logic — storage happens in src/app/storage.ts via localStorage.
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

/** Newest first, capped; the best-scoring run is kept even when it ages out. */
export function addEntry(list: ChronicleEntry[], e: ChronicleEntry, max = CHRONICLE_MAX): ChronicleEntry[] {
  const next = [e, ...list]
  if (next.length <= max || max < 2) return next.slice(0, max)
  let top = 0
  for (let i = 1; i < next.length; i++) if (next[i].score > next[top].score) top = i
  if (top < max) return next.slice(0, max)
  return [...next.slice(0, max - 1), next[top]]
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
        Number.isFinite(e.score) &&
        Number.isFinite(e.gold) &&
        e.gold >= 0 &&
        Number.isFinite(e.day) &&
        e.day >= 1 &&
        Number.isFinite(e.cities) &&
        e.cities >= 0,
    )
  } catch {
    return []
  }
}
