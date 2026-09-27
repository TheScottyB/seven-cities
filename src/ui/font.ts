/** The one typeface every canvas label uses. */
export const FONT_FAMILY = "'Courier New', monospace"

/** A canvas font string: `font(20, true)` is "bold 20px 'Courier New', monospace". */
export const font = (px: number, bold = false) => `${bold ? 'bold ' : ''}${px}px ${FONT_FAMILY}`
