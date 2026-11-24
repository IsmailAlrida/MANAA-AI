"use client"

import { IconX } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { IconFileSearch } from "@tabler/icons-react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Separator } from "@workspace/ui/components/separator"

import {
  entityLabel,
  type GraphEntity,
  type GraphRelationship,
} from "@/lib/api/types"
import { useLocale } from "@/lib/i18n"
import { EvidenceRefBadge, SupportBadge } from "../evidence"
import { Hint } from "../hint"
import { KindLabel } from "./graph/kind-icon"

export function EntityInspector({
  entity,
  relationships,
  labelFor,
  onClose,
  onOpenEvidence,
}: {
  entity: GraphEntity | null
  relationships: GraphRelationship[]
  labelFor: (id: string) => string
  onClose: () => void
  onOpenEvidence: () => void
}) {
  const { t, fmtDate, locale } = useLocale()

  if (!entity)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t.network.inspector}</EmptyTitle>
          <EmptyDescription>{t.network.noSelection}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

  const related = relationships.filter(
    (r) => r.fromEntityId === entity.id || r.toEntityId === entity.id
  )

  return (
    <Card aria-label={t.network.inspector}>
      <CardHeader>
        <CardTitle>{entityLabel(entity, locale) ?? entity.id}</CardTitle>
        <CardDescription>
          <KindLabel kind={entity.kind} />{" "}
          <SupportBadge support={entity.support} /> <code>{entity.id}</code>
        </CardDescription>
        <CardAction>
          <Hint label={t.hint.closePanel}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.hint.closePanel}
              onClick={onClose}
            >
              <IconX />
            </Button>
          </Hint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button variant="outline" onClick={onOpenEvidence}>
          <IconFileSearch />
          {t.network.openEvidence}
        </Button>
        <dl>
          <dt>{t.network.observed}</dt>
          <dd>{fmtDate(entity.observedAt, true)}</dd>
          <dt>{t.network.uncertainty}</dt>
          <dd>{entity.uncertainty ?? "—"}</dd>
        </dl>
        <Separator />
        <h3>{t.network.evidence}</h3>
        <div className="flex flex-wrap gap-1">
          {entity.provenance.map((p) => (
            <EvidenceRefBadge key={p.evidenceId} id={p.evidenceId} />
          ))}
        </div>
        <Separator />
        <h3>{t.network.relationships}</h3>
        <ItemGroup>
          {related.map((r) => {
            const other =
              r.fromEntityId === entity.id ? r.toEntityId : r.fromEntityId
            return (
              <Item key={r.id} size="sm" variant="outline">
                <ItemContent>
                  <ItemTitle>
                    {r.kind} → {labelFor(other)}{" "}
                    <SupportBadge support={r.support} />{" "}
                    {r.strength && (
                      <Badge variant="secondary">{t.network[r.strength]}</Badge>
                    )}
                  </ItemTitle>
                  {(r.rationaleVariants?.[locale] ?? r.rationale) && (
                    <ItemDescription dir="auto">
                      {r.rationaleVariants?.[locale] ?? r.rationale}
                    </ItemDescription>
                  )}
                </ItemContent>
              </Item>
            )
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  )
}
