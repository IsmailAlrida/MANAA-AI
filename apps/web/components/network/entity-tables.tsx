"use client"

import { Badge } from "@workspace/ui/components/badge"
import { KindLabel } from "./graph/kind-icon"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  entityLabel,
  type GraphEntity,
  type GraphRelationship,
} from "@/lib/api/types"
import { useLocale } from "@/lib/i18n"
import { SupportBadge } from "../evidence"

/** Accessible list alternative to the graph canvas (PRD §8). */
export function EntityTable({
  entities,
  selectedId,
  onSelect,
}: {
  entities: GraphEntity[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t, fmtDate, locale } = useLocale()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.network.list}</TableHead>
          <TableHead>{t.network.kind}</TableHead>
          <TableHead>{t.network.support}</TableHead>
          <TableHead>{t.network.observed}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entities.map((e) => (
          <TableRow
            key={e.id}
            data-state={e.id === selectedId ? "selected" : undefined}
            tabIndex={0}
            aria-selected={e.id === selectedId}
            onClick={() => onSelect(e.id)}
            onKeyDown={(ev) =>
              (ev.key === "Enter" || ev.key === " ") &&
              (ev.preventDefault(), onSelect(e.id))
            }
          >
            <TableCell>{entityLabel(e, locale) ?? e.id}</TableCell>
            <TableCell>
              <KindLabel kind={e.kind} />
            </TableCell>
            <TableCell>
              <SupportBadge support={e.support} />
            </TableCell>
            <TableCell>{fmtDate(e.observedAt, true)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function RelationshipTable({
  relationships,
  labelFor,
}: {
  relationships: GraphRelationship[]
  labelFor: (id: string) => string
}) {
  const { t, locale } = useLocale()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.network.from}</TableHead>
          <TableHead>{t.network.kind}</TableHead>
          <TableHead>{t.network.to}</TableHead>
          <TableHead>{t.network.support}</TableHead>
          <TableHead>{t.network.strength}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {relationships.map((r) => (
          <TableRow
            key={r.id}
            title={[
              r.rationaleVariants?.[locale] ?? r.rationale,
              r.strength
                ? `${t.network.strength}: ${t.network[r.strength]}`
                : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            <TableCell>{labelFor(r.fromEntityId)}</TableCell>
            <TableCell>
              <Badge variant="outline">{r.kind}</Badge>
            </TableCell>
            <TableCell>{labelFor(r.toEntityId)}</TableCell>
            <TableCell>
              <SupportBadge support={r.support} />
            </TableCell>
            <TableCell>{r.strength ? t.network[r.strength] : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
