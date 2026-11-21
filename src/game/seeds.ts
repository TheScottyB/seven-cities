/**
 * Shareable world seeds & named presets. Pure, DOM-free helpers so URL query
 * parsing and preset cycling are unit-testable in Node.
 */
export interface SeedPreset {
  readonly seed: string
  readonly label: string
}

export const SEED_PRESETS = [
  { seed: '1492', label: '1492 Classic' },
  { seed: '1519', label: '1519 Cortes-ish' },
  { seed: '6767', label: '6767 Gold-Tone' },
] as const satisfies readonly SeedPreset[]

export const DEFAULT_SEED = SEED_PRESETS[0].seed

/**
 * Extract a clean `?seed=` value from a URL search string, or null if absent
 * or empty. Strips control characters and caps length at 32 so shared links
 * stay readable on the title screen.
 */
export function parseSeedQuery(search: string): string | null {
  if (!search) return null
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const raw = params.get('seed')
  if (!raw) return null
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32)
  return cleaned.length > 0 ? cleaned : null
}

/** Cycle to the next named preset seed. */
export function nextSeedPreset(current: string): SeedPreset {
  const idx = SEED_PRESETS.findIndex((p) => p.seed === current)
  return SEED_PRESETS[(idx + 1) % SEED_PRESETS.length]
}

/** Label for a seed if it matches a named preset, otherwise null. */
export function presetLabel(seed: string): string | null {
  return SEED_PRESETS.find((p) => p.seed === seed)?.label ?? null
}
