"use client"

import * as React from "react"
import { IconAlertTriangle, IconExternalLink, IconFileText } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemTitle,
} from "@workspace/ui/components/item"

import { ticketText, type ReportBlock } from "@/lib/api/types"
import { useLocale } from "@/lib/i18n"
import { useWorkspace } from "@/lib/workspace/store"
import { Hint } from "./hint"
import { tone, type Tone } from "./tone"

/** Text label alongside variant so support never relies on colour alone. */
export function SupportBadge({ support }: { support?: string | null }) {
  const { t } = useLocale()
  if (!support) return null
  const toneName = `support-${support}` as Tone
  const known = support === "observed" || support === "possible" || support === "disputed"
  return (
    <Hint label={t.hint.support[support]}>
      <Badge variant="outline" tabIndex={0} style={known ? tone(toneName) : undefined}>
        {support}
      </Badge>
    </Hint>
  )
}

/** evidenceId → evidence block, built from every ticket's blocks. */
export function useEvidenceIndex() {
  const { tickets } = useWorkspace()
  const { locale } = useLocale()
  return React.useMemo(() => {
    const idx = new Map<string, ReportBlock>()
    for (const t of Object.values(tickets))
      for (const b of ticketText(t, locale).blocks) if (b.type === "evidence" && b.evidenceId) idx.set(b.evidenceId, b)
    return idx
  }, [tickets, locale])
}

export function EvidenceItem({ block }: { block: ReportBlock }) {
  const { t, fmtDate } = useLocale()
  return (
    <Item variant="outline" id={block.evidenceId}>
      <ItemContent>
        <ItemTitle>
          {block.title ?? block.evidenceId}
          <SupportBadge support={block.support} />
        </ItemTitle>
        {/* Source text rendered as plain text — never as HTML. */}
        {block.summary && <ItemDescription dir="auto" lang={block.language}>{block.summary}</ItemDescription>}
      </ItemContent>
      {block.asset?.url && (
        <ItemActions>
          <Hint label={t.hint.openSource}>
            <Button variant="outline" size="sm" asChild>
              <a href={block.asset.url} target="_blank" rel="noopener noreferrer">
                <IconExternalLink />
                {t.tickets.openSource}
              </a>
            </Button>
          </Hint>
        </ItemActions>
      )}
      <ItemFooter className="flex-wrap justify-start gap-x-4 gap-y-1 text-muted-foreground">
        <code dir="ltr">{block.evidenceId}</code>
        <span>
          {t.tickets.captured}: {fmtDate(block.capturedAt, true)}
        </span>
        {block.language && (
          <span>
            {t.tickets.language}: {block.language}
          </span>
        )}
        {block.collectionMethod && (
          <span>
            {t.tickets.method}: {block.collectionMethod}
          </span>
        )}
        {block.sourceReference && <code dir="ltr">{block.sourceReference}</code>}
      </ItemFooter>
    </Item>
  )
}

/** Citation chip; unresolved references render visibly instead of being dropped. */
export function EvidenceRefBadge({ id }: { id: string }) {
  const { t } = useLocale()
  const idx = useEvidenceIndex()
  const block = idx.get(id)
  return (
    <Hint label={block?.title ?? t.hint.unresolved}>
      <Badge variant={block ? "outline" : "ghost"} tabIndex={0}>
        {block ? <IconFileText /> : <IconAlertTriangle />}
        {id}
      </Badge>
    </Hint>
  )
}
