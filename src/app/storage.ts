/**
 * Every localStorage read, write and remove the shell makes: the save slot, the
 * chronicle, the save-owner claim and the mute choice. Each takes the Storage to
 * use (default: globalThis.localStorage, looked up inside the try, because merely
 * reading that property throws where the browser blocks site data).
 */
import { serializeSave, deserializeSave, type SaveData } from '../game/save'
import { addEntry, serializeChronicle, deserializeChronicle, type ChronicleEntry } from '../game/chronicle'

export const SAVE_KEY = 'seven-cities-save'
export const CHRONICLE_KEY = 'seven-cities-chronicle'
/** A fresh token written when a tab takes over the save; storage events only fire on a changed value. */
export const OWNER_KEY = 'seven-cities-save-owner'
export const AUDIO_KEY = 'seven-cities-audio'

/** What serializeSave takes: the running expedition. */
export type SaveInput = Parameters<typeof serializeSave>[0]

const local = (store?: Storage): Storage => store ?? globalThis.localStorage

export function loadMuted(store?: Storage): boolean {
  try {
    return local(store).getItem(AUDIO_KEY) === 'true'
  } catch {
    return false
  }
}

export function storeMuted(m: boolean, store?: Storage): void {
  try {
    local(store).setItem(AUDIO_KEY, JSON.stringify(m))
  } catch {
    /* the choice lasts for this tab only */
  }
}

/** Tell any other tab this one has taken the save over. */
export function announceOwner(store?: Storage): void {
  try {
    local(store).setItem(OWNER_KEY, `${Date.now()}-${Math.random()}`)
  } catch {
    /* no storage, nothing to contend for */
  }
}

/** Write the running expedition; true once it is in storage, false when storage is full or blocked. */
export function writeSave(data: SaveInput, store?: Storage): boolean {
  try {
    local(store).setItem(SAVE_KEY, serializeSave(data))
    return true
  } catch {
    return false
  }
}

export function loadSave(store?: Storage): SaveData | null {
  try {
    const raw = local(store).getItem(SAVE_KEY)
    return raw ? deserializeSave(raw) : null
  } catch {
    return null
  }
}

/** A stored save loadSave() rejects: damaged, or written in another format. */
export function unreadableSave(store?: Storage): boolean {
  try {
    const raw = local(store).getItem(SAVE_KEY)
    return !!raw && deserializeSave(raw) === null
  } catch {
    return false
  }
}

export function removeSave(store?: Storage): void {
  try {
    local(store).removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}

export function loadChronicle(store?: Storage): ChronicleEntry[] {
  try {
    return deserializeChronicle(local(store).getItem(CHRONICLE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function appendChronicle(entry: ChronicleEntry, store?: Storage): void {
  try {
    local(store).setItem(CHRONICLE_KEY, serializeChronicle(addEntry(loadChronicle(store), entry)))
  } catch {
    /* chronicle is a nicety — never let storage failures break the game */
  }
}
