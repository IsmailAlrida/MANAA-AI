"use client"

import { IconMessageCircle } from "@tabler/icons-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Separator } from "@workspace/ui/components/separator"

import { useLocale } from "@/lib/i18n"

/** Slot for assistant-ui. Independent of the investigation stream. Closed via the header toggle. */
export function AgentPanel() {
  const { t } = useLocale()
  return (
    <aside aria-label={t.agent.title} className="flex h-full flex-col">
      <h2 className="p-3 font-medium">{t.agent.title}</h2>
      <Separator />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconMessageCircle />
          </EmptyMedia>
          <EmptyTitle>{t.agent.unavailable}</EmptyTitle>
          <EmptyDescription>{t.agent.unavailableBody}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </aside>
  )
}
