"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"

/**
 * Hover/focus label. Wraps a single focusable child (asChild).
 * For icon-only buttons, also set aria-label on the child — the tooltip is
 * supplementary, not the accessible name.
 */
export function Hint({
  label,
  side,
  open,
  onOpenChange,
  children,
}: {
  label: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  /** Controlled mode, for hints that must appear on their own (e.g. after an action). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactElement
}) {
  if (!label) return children
  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
