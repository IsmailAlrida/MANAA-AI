import type { CSSProperties } from "react"

/** Semantic palette tones (tokens defined in packages/ui globals.css; see docs/DESIGN-PALETTE.md). */
export type Tone =
  | "support-observed" | "support-possible" | "support-disputed"
  | "status-open" | "status-overdue" | "status-closed"
  | "priority-high" | "priority-medium" | "priority-low"

/** Soft tint background + strong text, with a hairline border. Contrast ≥ 4.5:1 in both themes. */
export const tone = (name: Tone): CSSProperties => ({
  color: `var(--${name})`,
  backgroundColor: `var(--${name}-soft)`,
  borderColor: `color-mix(in oklch, var(--${name}) 28%, transparent)`,
})
