/** The one typeface every canvas label uses. */
const FONT_FAMILY = "'Courier New', monospace"

/** A canvas font string: `font(20, true)` is "bold 20px 'Courier New', monospace". */
export const font = (px: number, bold = false) => `${bold ? 'bold ' : ''}${px}px ${FONT_FAMILY}`

/** The largest bold size, up to `max`, at which `text` fits within `width` px. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, max: number, width: number): string {
  let px = max
  for (; px > 12; px -= 2) {
    ctx.font = font(px, true)
    if (ctx.measureText(text).width <= width) break
  }
  return font(px, true)
}
