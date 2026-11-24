/** One source of truth for link strength styling: edges and the legend both read this. */
export const STRENGTH_STYLE = {
  strong: { color: "var(--strength-strong)", width: 3 },
  medium: { color: "var(--strength-medium)", width: 2 },
  weak: { color: "var(--strength-weak)", width: 1.25 },
} as const

export const NEUTRAL_EDGE = { color: "var(--muted-foreground)", width: 1.25 } as const

/** Dashed = not directly observed (possible, disputed or unknown). */
export const INFERRED_DASH = "6 4"
