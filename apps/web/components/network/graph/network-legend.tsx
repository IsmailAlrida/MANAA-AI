"use client"

import { IconChevronUp, IconInfoCircle } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"

import { useLocale } from "@/lib/i18n"
import { useWorkspace, useWorkspaceActions } from "@/lib/workspace/store"
import { Hint } from "../../hint"
import { INFERRED_DASH, NEUTRAL_EDGE, STRENGTH_STYLE } from "./edge-style"
import type { KindGroup } from "./kind-icon"

const KIND_ORDER: KindGroup[] = ["org", "identity", "web", "content", "infra", "money"]

function Line({ color, width, dash, label }: { color: string; width: number; dash?: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <svg width="36" height="10" aria-hidden className="shrink-0">
        <line x1="2" y1="5" x2="34" y2="5" stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </li>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <ul className="flex flex-col gap-1.5 text-xs">{children}</ul>
    </div>
  )
}

/**
 * Hideable key for the graph. Reads the same style table as the edges and the
 * same kind tokens as the nodes, so it cannot drift from what is drawn.
 */
export function NetworkLegend() {
  const { t } = useLocale()
  const { legendOpen } = useWorkspace()
  const { setLegendOpen } = useWorkspaceActions()

  if (!legendOpen)
    return (
      <Hint label={t.network.showLegend}>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={false}
          aria-label={t.network.showLegend}
          style={{ background: "var(--card)" }}
          onClick={() => setLegendOpen(true)}
        >
          <IconInfoCircle />
          {t.network.legend}
        </Button>
      </Hint>
    )

  return (
    <section
      aria-label={t.network.legend}
      className="flex w-64 flex-col gap-3 rounded-lg border p-3 shadow-sm"
      style={{ background: "var(--card)", color: "var(--card-foreground)" }}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t.network.legend}</h3>
        <Hint label={t.network.hideLegend}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded
            aria-label={t.network.hideLegend}
            onClick={() => setLegendOpen(false)}
          >
            <IconChevronUp />
          </Button>
        </Hint>
      </header>

      <Group title={t.network.strength}>
        {(["strong", "medium", "weak"] as const).map((k) => (
          <Line key={k} color={STRENGTH_STYLE[k].color} width={STRENGTH_STYLE[k].width} label={t.network[k]} />
        ))}
      </Group>

      <Group title={t.network.evidence}>
        <Line color={NEUTRAL_EDGE.color} width={2} label={t.network.lineObserved} />
        <Line color={NEUTRAL_EDGE.color} width={2} dash={INFERRED_DASH} label={t.network.lineInferred} />
      </Group>

      <Group title={t.network.entityTypes}>
        {KIND_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-2.5 w-9 shrink-0 rounded-sm"
              style={{ background: `var(--kind-${k})` }}
            />
            <span>{t.network.kinds[k]}</span>
          </li>
        ))}
      </Group>

      <p className="text-xs text-muted-foreground">{t.network.strengthLegend}</p>
    </section>
  )
}
