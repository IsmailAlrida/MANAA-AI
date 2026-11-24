"use client"

import { IconRadar } from "@tabler/icons-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useLocale } from "@/lib/i18n"
import { useWorkspace } from "@/lib/workspace/store"

/**
 * Loading / empty states for list-style views. Never blocks the viewport on
 * backend failure: offline/error render the (empty) children, and the header
 * carries the status + retry.
 */
export function WorkspaceGate({ hasData, children }: { hasData: boolean; children: React.ReactNode }) {
  const ws = useWorkspace()

  if (ws.load.tag === "loading")
    return (
      <div className="flex flex-col gap-3 p-4" aria-busy>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64" />
      </div>
    )

  if (ws.load.tag === "ready" && !hasData) return <EmptyWorkspace />

  return <>{children}</>
}

export function EmptyWorkspace() {
  const { t } = useLocale()
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconRadar />
        </EmptyMedia>
        <EmptyTitle>{t.empty.workspaceTitle}</EmptyTitle>
        <EmptyDescription>{t.empty.workspaceBody}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
