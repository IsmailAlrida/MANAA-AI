"use client"

import Link from "next/link"
import { IconFileSearch, IconFileText, IconHistory, IconTopologyStar3 } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@workspace/ui/components/item"
import { Separator } from "@workspace/ui/components/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import { useLocale } from "@/lib/i18n"
import { ticketViewStatus } from "@/lib/workspace/derive"
import { entityLabel, ticketText } from "@/lib/api/types"
import { useNow, useWorkspace, useWorkspaceActions } from "@/lib/workspace/store"
import { EvidenceItem, EvidenceRefBadge, SupportBadge } from "../evidence"
import { PriorityBadge } from "../priority-badge"
import { WorkspaceGate } from "../shell/workspace-gate"
import { CloseTicketDialog } from "./close-ticket-dialog"
import { ClosingDateEditor } from "./closing-date-editor"
import { ReportBlocks } from "./report-blocks"
import { TicketStatusBadge } from "./ticket-status-badge"

export function TicketDetail({ ticketId }: { ticketId: string }) {
  const { t, fmtDate, locale } = useLocale()
  const ws = useWorkspace()
  const { selectEntity } = useWorkspaceActions()
  const now = useNow()
  const ticket = ws.tickets[ticketId]
  const text = ticket ? ticketText(ticket, locale) : undefined

  const crumbs = (current?: string) => (
    <Breadcrumb aria-label={t.tickets.back}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/tickets">{t.nav.tickets}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {current && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage dir="auto">{current}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )

  if (ws.load.tag !== "loading" && !ticket)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {ws.load.tag === "offline" ? t.tickets.unavailable : t.tickets.notFound}
          </EmptyTitle>
        </EmptyHeader>
        <EmptyContent>{crumbs()}</EmptyContent>
      </Empty>
    )

  return (
    <WorkspaceGate hasData={!!ticket}>
      {ticket && (
        <article className="mx-auto flex max-w-4xl flex-col gap-5 p-6" aria-labelledby="ticket-title">
          {crumbs(ticket.id)}

          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 max-w-2xl flex-col gap-1">
              <h1 id="ticket-title" dir="auto" className="text-xl font-semibold">{text?.title ?? ticket.title}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <TicketStatusBadge status={ticketViewStatus(ticket, now)} />
                {ticket.priority && <PriorityBadge level={ticket.priority.level} />}
                <code>{ticket.id}</code>
              </div>
              {ticket.priority?.reason && <p className="text-sm text-muted-foreground">{ticket.priority.reason}</p>}
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <ClosingDateEditor ticket={ticket} />
              <CloseTicketDialog ticket={ticket} />
            </div>
          </header>

          {ticket.finalWriteup && (
            <Item variant="muted">
              <ItemContent>
                <ItemTitle>{t.tickets.finalWriteup}</ItemTitle>
                <ItemDescription>{ticket.finalWriteup}</ItemDescription>
              </ItemContent>
            </Item>
          )}

          <Separator />

          <Tabs defaultValue="report">
            <TabsList>
              <TabsTrigger value="report">
                <IconFileText />
                {t.tickets.report}
              </TabsTrigger>
              <TabsTrigger value="evidence">
                <IconFileSearch />
                {t.tickets.evidence} <Badge variant="secondary">{ticket.evidenceIds.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="entities">
                <IconTopologyStar3 />
                {t.tickets.entities} <Badge variant="secondary">{ticket.entityIds.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="history">
                <IconHistory />
                {t.tickets.history}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="report">
              <ReportBlocks blocks={text?.blocks ?? ticket.blocks} />
            </TabsContent>

            <TabsContent value="evidence">
              <ItemGroup>
                {(text?.blocks ?? ticket.blocks)
                  .filter((b) => b.type === "evidence")
                  .map((b) => (
                    <EvidenceItem key={b.id} block={b} />
                  ))}
                {/* evidenceIds without a block still surface as citations */}
                <div className="flex flex-wrap gap-1">
                  {ticket.evidenceIds.map((id) => (
                    <EvidenceRefBadge key={id} id={id} />
                  ))}
                </div>
              </ItemGroup>
            </TabsContent>

            <TabsContent value="entities">
              <ItemGroup>
                {ticket.entityIds.map((id) => {
                  const e = ws.entities[id]
                  return (
                    <Item key={id} variant="outline" asChild>
                      <Link href="/network" onClick={() => selectEntity(id)}>
                        <ItemContent>
                          <ItemTitle>
                            {entityLabel(e, locale) ?? id} {e && <Badge variant="outline">{e.kind}</Badge>}{" "}
                            <SupportBadge support={e?.support} />
                          </ItemTitle>
                          {!e && <ItemDescription>{t.tickets.unresolved}</ItemDescription>}
                        </ItemContent>
                      </Link>
                    </Item>
                  )
                })}
              </ItemGroup>
            </TabsContent>

            <TabsContent value="history">
              {ticket.history?.length ? (
                <ItemGroup>
                  {ticket.history.map((h, i) => (
                    <Item key={`${h.at}-${i}`} size="sm" variant="outline">
                      <ItemContent>
                        <ItemTitle>
                          {h.kind} · {fmtDate(h.at, true)}
                        </ItemTitle>
                        {h.note && <ItemDescription>{h.note}</ItemDescription>}
                      </ItemContent>
                    </Item>
                  ))}
                </ItemGroup>
              ) : (
                <p>{t.tickets.noHistory}</p>
              )}
            </TabsContent>
          </Tabs>
        </article>
      )}
    </WorkspaceGate>
  )
}
