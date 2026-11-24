"use client"

import { IconArrowLeft } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item"
import { Separator } from "@workspace/ui/components/separator"

import type { GraphEntity, ReportBlock } from "@/lib/api/types"
import { entityLabel } from "@/lib/api/types"
import { useLocale } from "@/lib/i18n"
import { useEvidenceIndex } from "../evidence"
import { ReportBlocks } from "../tickets/report-blocks"
import { EvidenceRefBadge } from "../evidence"

export function EntityEvidence({ entity, onBack }: { entity: GraphEntity; onBack: () => void }) {
  const { t, locale } = useLocale()
  const evidenceIndex = useEvidenceIndex()
  const dossier = entity.dossierVariants?.[locale]
  const blocks: ReportBlock[] = [
    {
      id: `DOSSIER-${entity.id}-SUMMARY`,
      type: "markdown",
      text: dossier?.summary ?? t.network.noDossier,
    },
    ...entity.provenance.flatMap(({ evidenceId }) => {
      const block = evidenceIndex.get(evidenceId)
      return block ? [block] : []
    }),
  ]

  return (
    <section className="mx-auto flex h-full max-w-4xl flex-col gap-4 overflow-y-auto p-5" aria-label={t.network.evidenceTab}>
      <header className="flex items-start gap-3">
        <Button variant="outline" onClick={onBack}>
          <IconArrowLeft /> {t.network.backToGraph}
        </Button>
        <div className="min-w-0">
          <h1 dir="auto" className="text-xl font-semibold">{entityLabel(entity, locale) ?? entity.id}</h1>
          <p className="text-sm text-muted-foreground"><Badge variant="outline">{entity.kind}</Badge> <code>{entity.id}</code></p>
        </div>
      </header>

      <Separator />
      {entity.nameVariants?.length ? (
        <section>
          <h2 className="mb-2 font-medium">{t.network.namesAsRecorded}</h2>
          <div className="flex flex-wrap gap-2">
            {entity.nameVariants.map((name, index) => (
              <Item key={`${name.value}-${index}`} size="sm" variant="outline">
                <ItemContent>
                  <ItemTitle dir="auto">{name.value}</ItemTitle>
                  <ItemDescription>{name.languageTag} · {name.sourceReference}</ItemDescription>
                  <div className="flex gap-1">{name.evidenceIds.map((id) => <EvidenceRefBadge key={id} id={id} />)}</div>
                </ItemContent>
              </Item>
            ))}
          </div>
        </section>
      ) : null}

      {dossier?.fields.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t.network.dossierFields}</h2>
          {dossier.fields.map((field, index) => (
            <Item key={`${field.label}-${index}`} variant="outline">
              <ItemContent>
                <ItemTitle>{field.label}</ItemTitle>
                <ItemDescription dir="auto">{field.value}</ItemDescription>
                <div className="flex flex-wrap gap-1">{field.evidenceIds.map((id) => <EvidenceRefBadge key={id} id={id} />)}</div>
              </ItemContent>
            </Item>
          ))}
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-medium">{t.network.evidence}</h2>
        <ReportBlocks blocks={blocks} />
      </section>
    </section>
  )
}
