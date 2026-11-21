# Architecture

Technical design notes for *Six Seven Cities of Gold Tone Metal* — a zero-dependency, zero-asset Canvas 2D & WebAudio browser tribute to *The Seven Cities of Gold* (1984).

## Core Principles

1. **Pure simulation, thin browser shell.** World generation (`src/world/`), game rules & lore (`src/game/`), lifecycle state rules (`src/app/lifecycle.ts`), relief precomputation (`src/art/relief.ts`), hit regions (`src/ui/hit.ts`), and audio direction (`src/audio/{director,scene,score}.ts`) never import DOM, Canvas, or WebAudio APIs. They run directly in Node under Vitest.
2. **Zero runtime dependencies & zero asset files.** Every tile, sprite, parchment fiber, sound effect, ambient bed, and musical note is generated deterministically in code (~37 kB gzipped total).
3. **Pixel-honest rendering.** The backing store is sized in device pixels (`css * dpr`), the world draws at an integer device zoom with `imageSmoothingEnabled = false` and snapped screen origins, and UI panels draw in CSS pixels under the DPR transform.
4. **Fixed-timestep simulation with render interpolation.** `src/engine/loop.ts` steps simulation logic at a fixed 60 Hz (`dt = 1/60`, clamped against tab-switch stalls and non-monotonic clocks) and interpolates camera & explorer positions between the last two ticks for smooth scrolling on high-refresh displays.

## World Generation & Winnability (`src/world/`)

- **Seeded determinism:** `mulberry32` PRNG + FNV-1a string hashing (`src/world/rng.ts`) and 4-octave fractal value noise (`src/world/noise.ts`) generate a reproducible `192×192` New World.
- **Geography:** A continental mask, north-south mountain cordillera, downhill rivers carved to sea (canoe highways), an offshore island arc, and open western Atlantic leading back to Spain.
- **Amphibious reachability guarantee:** `placeVillages()` floods the fleet's home sea from the landing beach's nearest ocean ring and intersects it with walkable land (`reachableAmphibious()`), guaranteeing every village and all 7 Cities of Gold are reachable without portaging across disconnected ocean basins.

## Procedural Art Pipeline (`src/art/`, `src/engine/renderer.ts`)

- **Baked once at boot:** `tileset.ts` bakes 16×16 terrain frames indexed by `(decor, phase, shade)`; `edges.ts` bakes 4×4 Bayer-dithered terrain transition fringes; `paper.ts` bakes laid-vellum chart tiles and torn deckle fog edges; `spritebank.ts` pushes text-authored char grids through `blit → alpha-harden → 4-way cross outline → baked contact shadow`.
- **Precomputed per world:** `relief.ts` computes ocean depth bands (multi-source BFS), northwest-lit cordillera hillshading, and elevation-biased dressing density into flat typed arrays (`Uint8Array` / `Uint16Array`) so the per-frame draw loop does simple array reads.

## Procedural WebAudio & 3-Layer Testability (`src/audio/`)

```text
game state & events ──► director.ts / scene.ts (pure) ──► player.ts (thin WebAudio adapter)
```

1. **Pure unit tests (`director.ts`, `scene.ts`, `score.ts`):** Verify cue transitions, ambience beds, continuous soundscape modulation (wind, coast proximity, hostility, famine), and musical note bounds in Node with zero audio hardware.
2. **Cue log & texture counters:** `AudioPlayer` records emitted cues into a capped ring buffer and counts ambient texture firings (`__dbg.audioLog()`, `__dbg.audioScene()` in DEV builds).
3. **Offline spectral probes (`src/app/devhooks.ts`, DEV-only):** `renderCue`, `renderTexture`, and `renderTheme` render synthesis graphs onto an `OfflineAudioContext` to measure RMS, peak, and Goertzel frequency energies deterministically. Production builds strip all `__dbg` hooks (`scripts/check-dist.mjs` enforces this in CI).

## Persistence, Lifecycle & Hardening (`src/game/save.ts`, `src/app/`)

- **Save format v7:** Stores mutable expedition state plus bit-packed base64 fog (~6 kB) and an FNV-1a `mapFingerprint` of terrain and village placement. `deserializeSave()` validates finite ranges and active status; `validateSaveForWorld()` verifies fingerprint, fog byte length, and map bounds before mutating live state.
- **Shell resilience:** Single-owner multi-tab save coordination (`storage` events), focus/visibility auto-pause + audio suspend + autosave, OS/modifier shortcut isolation (`isIgnoredKey`), ES Explicit Resource Management (`using` / `Symbol.dispose`) on `Input` and `AudioPlayer`, and a canvas-only crash recovery card (`Esc` reload, `X` discard save & reload).
- **Toolchain & supply chain:** Node 26 LTS, TypeScript 7 (`strict`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`), Vite 8 (Rolldown), Vitest 5, and `pnpm 12` hardened via `pnpm-workspace.yaml` (`onlyBuiltDependencies: []`, `strictDepBuilds: true`, `blockExoticSubdeps: true`, `trustPolicy: no-downgrade`).
