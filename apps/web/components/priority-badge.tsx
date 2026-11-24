"use client"

import { IconFlag } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"

import { useLocale } from "@/lib/i18n"
import { Hint } from "./hint"
import { tone, type Tone } from "./tone"

const TONES: Record<string, Tone> = { high: "priority-high", medium: "priority-medium", low: "priority-low" }

/** Priority as text + flag + tint (never colour alone). The reason is the hover label. */
export function PriorityBadge({ level, reason }: { level?: string; reason?: string }) {
  const { t } = useLocale()
  if (!level) return <span aria-label={t.hint.noPriority}>—</span>
  const toneName = TONES[level]
  return (
    <Hint label={reason ?? t.hint.noPriority}>
      <Badge variant="outline" tabIndex={0} style={toneName ? tone(toneName) : undefined}>
        <IconFlag />
        {level}
      </Badge>
    </Hint>
  )
}
