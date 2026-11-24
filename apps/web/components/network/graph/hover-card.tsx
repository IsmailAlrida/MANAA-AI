"use client"

import * as React from "react"
import { Badge } from "@workspace/ui/components/badge"

import { entityLabel, safeImageUrl, type GraphEntity } from "@/lib/api/types"
import { useLocale } from "@/lib/i18n"
import { KindChip, KindLabel, kindStyle } from "./kind-icon"

/**
 * Small dossier summary that floats at the pointer after a short hover. Purely
 * supplementary (aria-hidden, click still opens the full inspector), with a hard
 * size cap and ellipsis on every text block. The 64x64 picture comes from the
 * entity's optional `image`; without one it shows the kind's shape and glyph.
 */
export function EntityHoverCard({
  entity,
  links,
  epic,
  x,
  y,
}: {
  entity: GraphEntity
  links: number
  epic?: string
  x: number
  y: number
}) {
  const { locale, t } = useLocale()
  const dossier = entity.dossierVariants?.[locale]
  const src = safeImageUrl(entity.image?.url)
  const [broken, setBroken] = React.useState(false)
  const fields = dossier?.fields.slice(0, 2) ?? []

  return (
    <div
      aria-hidden
      dir="auto"
      className="pointer-events-none absolute z-20 flex max-h-56 w-72 max-w-[calc(100%-1rem)] gap-3 overflow-hidden rounded-xl border p-3 shadow-lg"
      style={{ left: x, top: y, background: "var(--card)", color: "var(--card-foreground)" }}
    >
      <div
        className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{ background: `var(--kind-${kindStyle(entity.kind).group})` }}
      >
        {src && !broken ? (
          // Backend-served asset (same origin); never an arbitrary remote URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={entity.image?.alt ?? ""}
            width={64}
            height={64}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-16 object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <KindChip kind={entity.kind} size={44} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="truncate text-sm font-semibold">{entityLabel(entity, locale) ?? entity.id}</div>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <KindLabel kind={entity.kind} size={16} />
          {entity.support && (
            <Badge variant="outline" className="shrink-0">
              {entity.support}
            </Badge>
          )}
        </div>
        {dossier?.summary && <p className="line-clamp-3 text-xs">{dossier.summary}</p>}
        {fields.map((f) => (
          <div key={f.label} className="truncate text-xs">
            <span className="text-muted-foreground">{f.label}: </span>
            {f.value}
          </div>
        ))}
        <div className="truncate text-[11px] text-muted-foreground">
          {t.network.linkCount}: {links}
          {epic ? ` · ${t.network.inEpic}: ${epic}` : ""}
        </div>
      </div>
    </div>
  )
}
