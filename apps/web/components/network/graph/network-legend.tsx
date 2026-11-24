"use client"

import { IconChevronUp, IconInfoCircle } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"

import { useLocale } from "@/lib/i18n"
import { useWorkspace, useWorkspaceActions } from "@/lib/workspace/store"
import { Hint } from "../../hint"
import { INFERRED_DASH, STRENGTH_STYLE } from "./edge-style"
import type { KindGroup } from "./kind-icon"

const KIND_ORDER: KindGroup[] = ["org", "identity", "web", "content", "infra", "money"]

function Sample({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="22" height="10" aria-hidden className="shrink-0">{children}</svg>
      <span className="truncate">{label}</span>
    </li>
  )
}
const Stroke = ({ color, width, dash }: { color: string; width: number; dash?: string }) => (
  <line x1="1" y1="5" x2="21" y2="5" strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" style={{ stroke: color }} />
)

/**
 * Compact, hideable key. Reads the same style table as the links and the same
 * kind tokens as the dots, so it cannot drift from what is drawn.
 */
export function NetworkLegend() {
  const { t } = useLocale()
  const { legendOpen } = useWorkspace()
  const { setLegendOpen } = useWorkspaceActions()

  if (!legendOpen)
    return (
      <Hint label={t.network.showLegend}>
        <Button variant="outline" size="icon-sm" aria-expanded={false} aria-label={t.network.showLegend} style={{ background: "var(--card)" }} onClick={() => setLegendOpen(true)}>
          <IconInfoCircle />
        </Button>
      </Hint>
    )

  return (
    <section
      aria-label={t.network.legend}
      className="flex w-44 flex-col gap-2 rounded-lg border px-2.5 py-2 text-[11px] shadow-sm"
      style={{ background: "var(--card)", color: "var(--card-foreground)" }}
    >
      <header className="flex items-center justify-between gap-1">
        <Hint label={t.network.strengthLegend}>
          <h3 tabIndex={0} className="text-xs font-semibold">{t.network.legend}</h3>
        </Hint>
        <Hint label={t.network.hideLegend}>
          <Button variant="ghost" size="icon-xs" aria-expanded aria-label={t.network.hideLegend} onClick={() => setLegendOpen(false)}>
            <IconChevronUp />
          </Button>
        </Hint>
      </header>

      <ul aria-label={t.network.strength} className="flex flex-col gap-1">
        <li className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.network.strength}</li>
        {(["strong", "medium", "weak"] as const).map((k) => (
          <Sample key={k} label={t.network[k]}>
            <Stroke color={STRENGTH_STYLE[k].color} width={STRENGTH_STYLE[k].width} />
          </Sample>
        ))}
        <Sample label={t.network.lineInferred}>
          <Stroke color="var(--muted-foreground)" width={1.5} dash={INFERRED_DASH} />
        </Sample>
        <Sample label={t.network.cluster}>
          <rect x="1" y="1" width="20" height="8" rx="4" strokeWidth="1.2" style={{ fill: "color-mix(in oklch, var(--community-1) 14%, transparent)", stroke: "var(--community-1)" }} />
        </Sample>
      </ul>

      <ul aria-label={t.network.entityTypes} className="grid grid-cols-2 gap-x-2 gap-y-1 border-t pt-2">
        {KIND_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--kind-${k})` }} />
            <span className="truncate">{t.network.kinds[k]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
