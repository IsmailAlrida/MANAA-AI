"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  IconArrowsLeftRight,
  IconList,
  IconShieldCheck,
  IconTicket,
  IconTopologyStar3,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import { useLocale } from "@/lib/i18n"
import { ticketViewStatus } from "@/lib/workspace/derive"
import { useNow, useWorkspace, useWorkspaceActions, type NetworkViewId } from "@/lib/workspace/store"
import { Hint } from "../hint"

/**
 * The only navigation surface: brand, the two primary pages, and — on Network —
 * the Graph / Entities / Relationships switch. No sidebar, no in-viewport tab bar.
 */
export function TopNav() {
  const { t } = useLocale()
  const pathname = usePathname()
  const ws = useWorkspace()
  const { setNetworkView } = useWorkspaceActions()
  const now = useNow()

  const openCount = Object.values(ws.tickets).filter((tk) => ticketViewStatus(tk, now) !== "closed").length
  const pages = [
    { href: "/network", label: t.nav.network, icon: IconTopologyStar3, badge: undefined },
    { href: "/tickets", label: t.nav.tickets, icon: IconTicket, badge: openCount || undefined },
  ]
  const views: { id: NetworkViewId; label: string; icon: typeof IconList }[] = [
    { id: "graph", label: t.network.graph, icon: IconTopologyStar3 },
    { id: "entities", label: t.network.list, icon: IconList },
    { id: "relationships", label: t.network.relationships, icon: IconArrowsLeftRight },
  ]

  return (
    <nav aria-label={t.product} className="flex flex-wrap items-center gap-1">
      <Hint label={ws.workspaceId ?? t.workspace}>
        <span tabIndex={0} className="flex items-center gap-2 px-2 font-semibold">
          <IconShieldCheck className="size-5 shrink-0 text-primary" />
          {t.product}
        </span>
      </Hint>

      {pages.map((p) => {
        const active = pathname.startsWith(p.href)
        return (
          <Button key={p.href} variant={active ? "secondary" : "ghost"} asChild>
            <Link href={p.href} aria-current={active ? "page" : undefined}>
              <p.icon />
              {p.label}
              {p.badge != null && <Badge variant="outline">{p.badge}</Badge>}
            </Link>
          </Button>
        )
      })}

      {pathname.startsWith("/network") && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={ws.networkView}
            onValueChange={(v) => v && setNetworkView(v as NetworkViewId)}
            aria-label={t.network.graph}
          >
            {views.map((v) => (
              <Hint key={v.id} label={v.label}>
                <ToggleGroupItem value={v.id} aria-label={v.label}>
                  <v.icon />
                </ToggleGroupItem>
              </Hint>
            ))}
          </ToggleGroup>
        </>
      )}
    </nav>
  )
}
