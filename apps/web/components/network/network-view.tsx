"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Badge } from "@workspace/ui/components/badge"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable"
import { Spinner } from "@workspace/ui/components/spinner"
import { Tabs, TabsContent } from "@workspace/ui/components/tabs"

import { useLocale } from "@/lib/i18n"
import { useWorkspace, useWorkspaceActions } from "@/lib/workspace/store"
import { entityLabel } from "@/lib/api/types"
import { EmptyWorkspace } from "../shell/workspace-gate"
import { EntityInspector } from "./entity-inspector"
import { EntityEvidence } from "./entity-evidence"
import { EntityTable, RelationshipTable } from "./entity-tables"

// Canvas is client-only and heavy; keep it out of the initial bundle.
const NetworkGraph = dynamic(() => import("./graph/network-graph").then((m) => m.NetworkGraph), {
  ssr: false,
  loading: () => null,
})

/**
 * The canvas always renders — empty, loading or offline — so the viewport is
 * never blank. Status sits on top of the grid as an overlay; the header owns
 * offline/retry.
 */
export function NetworkView() {
  const { t, locale } = useLocale()
  const ws = useWorkspace()
  const { selectEntity } = useWorkspaceActions()
  const [showEntityEvidence, setShowEntityEvidence] = React.useState(false)

  const entities = React.useMemo(() => Object.values(ws.entities), [ws.entities])
  const relationships = React.useMemo(() => Object.values(ws.relationships), [ws.relationships])
  const labelFor = React.useCallback((id: string) => entityLabel(ws.entities[id], locale) ?? id, [ws.entities, locale])
  const selected = ws.selectedEntityId ? (ws.entities[ws.selectedEntityId] ?? null) : null
  React.useEffect(() => setShowEntityEvidence(false), [ws.selectedEntityId])

  const overlay =
    ws.load.tag === "loading" ? (
      <Spinner aria-label={t.run.loading} />
    ) : ws.load.tag === "ready" && entities.length === 0 ? (
      <EmptyWorkspace />
    ) : null

  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel id="graph" minSize="45%">
        <div className="relative h-full min-h-0">
          <div className={`absolute inset-0 ${showEntityEvidence && selected ? "invisible pointer-events-none" : ""}`} aria-hidden={showEntityEvidence && !!selected}>
        <Tabs value={ws.networkView} className="h-full gap-0">
          <TabsContent value="graph" className="min-h-0">
            <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2" aria-label={t.network.strengthLegend}>
              <span className="text-xs text-muted-foreground">{t.network.strength}</span>
              {(["strong", "medium", "weak"] as const).map((strength) => <Badge key={strength} variant="outline">{t.network[strength]}</Badge>)}
              <span className="text-xs text-muted-foreground">{t.network.strengthLegend}</span>
            </div>
            <div className="min-h-0 flex-1">
              <NetworkGraph
                entities={entities}
                relationships={relationships}
                selectedId={ws.selectedEntityId}
                onSelect={selectEntity}
                overlay={overlay}
              />
            </div>
            </div>
          </TabsContent>
          <TabsContent value="entities" className="overflow-auto p-2">
            <EntityTable entities={entities} selectedId={ws.selectedEntityId} onSelect={selectEntity} />
          </TabsContent>
          <TabsContent value="relationships" className="overflow-auto p-2">
            <RelationshipTable relationships={relationships} labelFor={labelFor} />
          </TabsContent>
        </Tabs>
          </div>
          {showEntityEvidence && selected ? <div className="absolute inset-0 bg-background"><EntityEvidence entity={selected} onBack={() => setShowEntityEvidence(false)} /></div> : null}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="inspector" defaultSize="28%" minSize="20%" maxSize="50%" collapsible>
        <div className="h-full overflow-auto p-4">
          <EntityInspector
            entity={selected}
            relationships={relationships}
            labelFor={labelFor}
            onClose={() => selectEntity(null)}
            onOpenEvidence={() => setShowEntityEvidence(true)}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
