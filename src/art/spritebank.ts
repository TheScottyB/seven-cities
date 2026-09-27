/**
 * ===========================================================================
 * spritebank.ts — baked, hard-edged sprite cells for the expedition.
 * ===========================================================================
 *
 * WHAT THIS IS
 *   Every sprite here is authored as text (a char grid, one character per
 *   pixel) and then pushed through ONE pipeline at boot:
 *
 *       art grid -> blit -> harden() -> outlined() -> over baked shadow
 *
 *   harden() is a getImageData/putImageData pass. It is far too slow to run
 *   per frame, so the whole bank is prebuilt once and only ever blitted after
 *   that. Nothing in this module touches the DOM at module scope.
 *
 * PALETTE NOTE
 *   The obvious steel ramp (#e2e6ef / #aeb2bf) is cool blue-white and fights
 *   this game's warm gold-on-navy world. The armour here is warmed toward
 *   parchment instead. Do not "correct" it back to blue.
 * ===========================================================================
 */

import {
  ANCHOR_X,
  CELL,
  bakeCell,
  cellFrom,
  mirror,
  shadowCell,
  shiftLegs,
  shiftRows,
  type Grid,
  type Palette,
} from './pixels'
import { Facing, GAIT_RATE } from '../game/gait'

// --- palettes --------------------------------------------------------------

/** Warm, parchment-leaning armour. See PALETTE NOTE above. */
const FIG: Palette = {
  o: '#160f09', // ink — helmet shadow, eye sockets
  L: '#e8e2d4', // steel light
  M: '#b8b0a2', // steel mid
  D: '#7d7669', // steel dark
  c: '#b1372f', // crimson cape
  C: '#7e2620', // cape in fold
  g: '#f4c430', // gilt gorget
  s: '#e3c1a0', // skin
  S: '#a8815f', // skin in the helmet's shadow
  p: '#6a4a2c', // pike shaft
  b: '#3a2a1c', // boot leather
}

const SHIP: Palette = {
  d: '#46301c', // hull dark / boot topping
  h: '#6a4526', // hull mid
  H: '#9a6a3c', // lit gunwale
  m: '#4a3320', // mast
  w: '#f0ead8', // mainsail, warm white
  W: '#cfc4ab', // sail in the belly's shade
  r: '#b1372f', // cross of Castile, and the pennant
  g: '#f4c430', // gilt taffrail
}

// --- the conquistador ------------------------------------------------------
// 11 x 15. Morion helmet with a flared brim, the face sunk in its shadow,
// crimson cape, lit breastplate, gilt gorget, pike shouldered on the right.

const FIG_W = 11
/**
 * A flip about the cell maps column x to CELL-1-x, so art only mirrors onto
 * itself when it straddles column 11.5. Odd-width art cannot: the mirrored
 * figure lands one pixel right of the original, so the mirrored facing is
 * drawn MIRROR_DX to the left to shift it back. Without that the conquistador
 * hops sideways the instant he turns.
 */
const FIG_X = Math.floor(ANCHOR_X - FIG_W / 2) // 6
const MIRROR_DX = (CELL - FIG_W) % 2 // 1 for odd-width art in an even cell
const FIG_Y = 6 // art rows 6..20; row 20 is the ground line
const FIG_GROUND = FIG_Y + 15 // 21 -> feet sit on row 20, shadow on row 20

/** Facing south: toward the player. The pose that gets looked at most. */
const FIG_S: Grid = [
  '....MMM...L', // helmet comb            + pike point
  '...MLLLM..M',
  '..DMLLLMD.p',
  '.DMMMMMMMDp', // the flared brim
  '...oSSSo..p', // brow and eyes, sunk in the brim's shadow
  '...ossso..p', // lit jaw between the helmet's cheek pieces
  '.ccgLLLgccp', // gilt gorget between the cape's shoulders
  '.cCMLLLMCc.',
  '.cCMLLLMCc.',
  '.cCMMLMMCc.',
  '..CMMMMMC..',
  '...MM.MM...',
  '...DM.MD...',
  '...DM.MD...',
  '...bb.bb...',
]

/** Facing north: no face, and the cape takes over the whole back. */
const FIG_N: Grid = [
  '....MMM...L',
  '...MLLLM..M',
  '..DMMMMMD.p',
  '.DMMMMMMMDp',
  '...DMMMD..p', // gorget from behind
  '...ccgcc..p', // narrow at the shoulders, gilt clasp at the collar
  '..ccccccc.p',
  '.cCccCccCc.', // ...spreading, with a fold down the centre
  '.cCccCccCc.',
  '.cCCcCcCCc.',
  '..CCcCcCC..',
  '...MM.MM...',
  '...DM.MD...',
  '...DM.MD...',
  '...bb.bb...',
]

/** Facing east. Narrow profile, cape trailing astern, pike butted on the ground. */
// The pike is carried TIGHT against the shoulder. Held even one pixel clear,
// the 1px contours of shaft and body meet in the gap and fuse it into a solid
// black slab — the figure stops reading as a man with a pike and becomes a
// blot. Shouldered, the shaft stays a brown stripe along his silhouette.
const FIG_E: Grid = [
  '...MMM.....',
  '..MLLLM....',
  '.DMLLLMML..', // the pike's steel head clears the helmet
  '.DMMMMMMp..',
  '..oSssoDp..', // nose breaks the profile
  '..osssDDp..', // lit jaw
  '.cgLLLgDp..',
  '.cCMLLLMp..', // the hand grips the shaft at the shoulder
  '.cCMLLMDp..',
  '.cCMMLMDp..',
  '..CMMMMDp..',
  '..MMMMDp...',
  '..DM.MDp...',
  '..DM.MD....',
  '..bb.bb....',
]

/**
 * Four gait frames from shifted leg rows: together, near leg out, together,
 * far leg out. The shift window excludes the pike column so the butt of the
 * pike stays planted while the legs work.
 */
type LegRig = { legTop: number; colLo: number; colHi: number; midCol: number }
// The windows are one column wider than the legs on each side, so a 1px step
// displaces the leg instead of shaving a column off it. Both stop short of the
// pike column, which must stay planted.
const RIG_FRONT: LegRig = { legTop: 11, colLo: 2, colHi: 8, midCol: 5 }
const RIG_SIDE: LegRig = { legTop: 11, colLo: 1, colHi: 7, midCol: 4 }

/** dxNear, dyNear, dxFar, dyFar per frame. */
const GAIT_STEPS: readonly [number, number, number, number][] = [
  [0, 0, 0, 0],
  [-1, 0, 0, -1],
  [0, 0, 0, 0],
  [0, -1, 1, 0],
]

function gaitFrames(rows: Grid, rig: LegRig): string[][] {
  return GAIT_STEPS.map(([dxn, dyn, dxf, dyf]) =>
    shiftLegs(rows, rig.legTop, rig.colLo, rig.colHi, rig.midCol, dxn, dyn, dxf, dyf),
  )
}

// --- the caravel -----------------------------------------------------------
// 20 x 17. HALF the detail that wants to be here: one mast, one bellied
// mainsail with the cross of Castile, a raised sterncastle and a lit gunwale.
// Rigging stays, gunports, foremast and mizzen are all deliberately CUT —
// at 1px they are noise, and harden() turns diagonal stays into dotted stairs.
// The flagship has to be the most instantly locatable object on the screen.

const SHIP_W = 20
const SHIP_X = Math.round(ANCHOR_X - SHIP_W / 2) // 2
const SHIP_Y = 3 // art rows 3..19
const SHIP_WATERLINE = SHIP_Y + 15 // 18

const SHIP_E: Grid = [
  '........m...........', // masthead
  '........mrrr........', // pennant
  '........mwwww.......', // head of the mainsail
  '........mwwrww......', // cross of Castile, vertical limb
  '........mwwrwww.....',
  '........mrrrrrw.....', // ...and its arms
  '........mwwrwwWw....', // the belly starts to shade
  '........mwwrwWWw....',
  '........mwwwWWw.....',
  '........mwwWw.......', // foot of the sail
  '........m...........',
  '..gHHH..m...........', // sterncastle, gilt taffrail — mast runs through
  '..dhhH..m...........',
  '..dhhHHHHHHHHHHHHH..', // lit gunwale running to the bow — the mast stops at the deck
  '..dhhhhhhhhhhhhhhh..',
  '...dhhhhhhhhhhhhd...',
  '.....dddddddddd.....', // boot topping
]

// --- the bank --------------------------------------------------------------

export interface SpriteBank {
  /** [facing][gaitFrame] — facing indexed by the Facing enum, 4 gait frames. */
  explorer: HTMLCanvasElement[][]
  /** [facing][heelFrame] — 2 heel frames. */
  ship: HTMLCanvasElement[][]
  /** Where the art's anchor sits inside a cell. */
  anchor: { x: number; explorerY: number; shipY: number }
  cell: number
}

/** Caravel facings that are drawn from the mirrored E profile. */
const SHIP_MIRRORED = [false, true, false, true] // S, W, E, N

/** Build every sprite cell. Call ONCE at boot, before the first frame — never inside a frame. */
export function buildSpriteBank(): SpriteBank {
  const figShadow = shadowCell(ANCHOR_X, FIG_GROUND - 1, 4, 0.32)
  const shipShadow = shadowCell(ANCHOR_X, SHIP_WATERLINE + 1, 8, 0.24)

  const bakeFig = (rows: Grid) => bakeCell(cellFrom(rows, FIG, FIG_X, FIG_Y), figShadow)

  const south = gaitFrames(FIG_S, RIG_FRONT).map(bakeFig)
  const north = gaitFrames(FIG_N, RIG_FRONT).map(bakeFig)
  const east = gaitFrames(FIG_E, RIG_SIDE).map(bakeFig)
  const west = east.map(mirror) // the mirror trick — only valid because ANCHOR_X === CELL/2

  const explorer: HTMLCanvasElement[][] = []
  explorer[Facing.S] = south
  explorer[Facing.W] = west
  explorer[Facing.E] = east
  explorer[Facing.N] = north

  // Two heel frames: the rig above the deck rolls one pixel to leeward.
  const hullTop = 11
  const heelA = bakeCell(cellFrom(SHIP_E, SHIP, SHIP_X, SHIP_Y), shipShadow)
  const heelB = bakeCell(cellFrom(shiftRows(SHIP_E, 0, hullTop - 1, 1), SHIP, SHIP_X, SHIP_Y), shipShadow)
  const shipE = [heelA, heelB]
  const shipW = shipE.map(mirror)

  const ship: HTMLCanvasElement[][] = []
  for (let f = 0; f < 4; f++) ship[f] = SHIP_MIRRORED[f] ? shipW : shipE

  return {
    explorer,
    ship,
    anchor: { x: ANCHOR_X, explorerY: FIG_GROUND - 1, shipY: SHIP_WATERLINE },
    cell: CELL,
  }
}

function clampFacing(facing: number | undefined): number {
  return facing === Facing.W || facing === Facing.E || facing === Facing.N ? facing : Facing.S
}

/** Ships restored from a save carry no facing; they were moored heading east. */
function clampShipFacing(facing: number | undefined): number {
  return facing === Facing.W || facing === Facing.E || facing === Facing.N || facing === Facing.S
    ? facing
    : Facing.E
}

/** Draw offset for the mirrored (west) explorer cell: shifts it back one pixel. */
export function figMirrorDx(facing: number): number {
  return facing === Facing.W ? -MIRROR_DX : 0
}

/** Gait counter -> walk-cycle frame. 4 frames; rate 2.0 divides the % 8 wrap exactly. */
export function gaitFrameIndex(gait: number): number {
  return Math.floor(Math.max(0, gait) * GAIT_RATE) & 3
}

/**
 * Draw the conquistador with his feet on (cx, cy): cy is the ground point, not
 * his centre. `facing` is a Facing value (S=0, W=1, E=2, N=3); anything else
 * draws south. `gait` is his gait counter; 0 is the neutral standing pose.
 * cx/cy are rounded here, so fractional camera coordinates are fine.
 */
export function drawExplorerSprite(
  g: CanvasRenderingContext2D,
  bank: SpriteBank,
  cx: number,
  cy: number,
  facing: number | undefined,
  gait = 0,
): void {
  const f = clampFacing(facing)
  const cells = bank.explorer[f]
  g.drawImage(
    cells[gaitFrameIndex(gait)],
    Math.round(cx) - bank.anchor.x + figMirrorDx(f),
    Math.round(cy) - bank.anchor.explorerY,
  )
}

/**
 * Draw the caravel with her waterline on (cx, cy). `facing` is a Facing value;
 * undefined (a ship restored from a save) draws heading east. `t` is elapsed
 * seconds and drives both the heel frame and a 1px bob; t < 0 (the default)
 * draws a still, un-heeled ship for maps and menus.
 */
export function drawShipSprite(
  g: CanvasRenderingContext2D,
  bank: SpriteBank,
  cx: number,
  cy: number,
  facing: number | undefined,
  t = -1,
): void {
  const cells = bank.ship[clampShipFacing(facing)]
  let heel = 0
  let bob = 0
  if (t >= 0) {
    const phase = t * 1.1 + cx * 0.05
    heel = Math.sin(phase) > 0 ? 1 : 0
    bob = Math.sin(phase * 1.9) > 0.3 ? -1 : 0
  }
  g.drawImage(cells[heel], Math.round(cx) - bank.anchor.x, Math.round(cy) - bank.anchor.shipY + bob)
}
