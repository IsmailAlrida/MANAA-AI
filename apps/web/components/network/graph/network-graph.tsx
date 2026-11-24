"use client"

import "@xyflow/react/dist/style.css"

import * as React from "react"
import { useTheme } from "next-themes"
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from "@xyflow/react"

import { entityLabel, type GraphEntity, type GraphRelationship } from "@/lib/api/types"
import { useLocale } from "@/lib/i18n"
import { useWorkspace } from "@/lib/workspace/store"
import { EntityNode, type EntityNodeType } from "./entity-node"
import { EvidenceEdge, type EvidenceEdgeType } from "./evidence-edge"
import { placeNewNodes } from "./layout"

const nodeTypes = { entity: EntityNode }
const MARGIN = "48px"
const LEGEND_ROOM = "296px" // 16rem legend plus gutters

/** Frame the graph clear of the legend, which sits on the start side (left in LTR, right in RTL). */
const fitOptions = (side: "left" | "right", reserveLegend: boolean) =>
  ({
    padding: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, [side]: reserveLegend ? LEGEND_ROOM : MARGIN },
    maxZoom: 1,
  }) as const

/**
 * `fitView` only runs at init. If the canvas mounted empty (fresh workspace,
 * offline, loading), frame the graph once when the first nodes arrive — and
 * never again, so later streamed upserts don't move the camera.
 */
function FitOnFirstNodes({ count, options }: { count: number; options: ReturnType<typeof fitOptions> }) {
  const { fitView } = useReactFlow()
  const measured = useNodesInitialized()
  const fitted = React.useRef(false)
  React.useEffect(() => {
    // Wait until React Flow has measured node sizes; fitting earlier frames a zero-size graph.
    if (fitted.current || count === 0 || !measured) return
    fitted.current = true
    void fitView(options)
  }, [count, measured, fitView, options])
  return null
}

function buildNodes(
  prev: EntityNodeType[],
  entities: GraphEntity[],
  relationships: GraphRelationship[],
  selectedId: string | null,
  locale: "en" | "ar"
): EntityNodeType[] {
  const placed = new Map(prev.map((n) => [n.id, n.position]))
  const positions = placeNewNodes(placed, entities, relationships)
  return entities.map((e) => ({
    id: e.id,
    type: "entity" as const,
    position: positions.get(e.id) ?? { x: 0, y: 0 },
    data: { entity: e },
    selected: e.id === selectedId,
    ariaLabel: `${e.kind}: ${entityLabel(e, locale) ?? e.id}`,
  }))
}
const edgeTypes = { evidence: EvidenceEdge }

/**
 * Stable placement: nodes keep their existing (or dragged) positions; only new
 * nodes get a dagre position. fitView runs once on mount — streamed upserts
 * never move the camera or steal focus.
 */
export function NetworkGraph({
  entities,
  relationships,
  selectedId,
  onSelect,
  overlay,
  legend,
}: {
  entities: GraphEntity[]
  relationships: GraphRelationship[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Status content (loading/empty) floated over the grid; the canvas never unmounts. */
  overlay?: React.ReactNode
  /** Hideable key, pinned to the start side of the canvas. */
  legend?: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()
  const { locale } = useLocale()
  const { legendOpen } = useWorkspace()
  const fit = React.useMemo(() => fitOptions(locale === "ar" ? "right" : "left", !!legend && legendOpen), [locale, legend, legendOpen])
  // Build the first frame synchronously so `fitView` (init-only) sees real nodes.
  const [initialNodes] = React.useState(() => buildNodes([], entities, relationships, selectedId, locale))
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeType>(initialNodes)

  React.useEffect(() => {
    setNodes((prev) => buildNodes(prev, entities, relationships, selectedId, locale))
  }, [entities, relationships, selectedId, setNodes, locale])

  const edges = React.useMemo<EvidenceEdgeType[]>(
    () =>
      relationships.map((r) => ({
        id: r.id,
        type: "evidence" as const,
        source: r.fromEntityId,
        target: r.toEntityId,
        data: { relationship: r },
        markerEnd: { type: MarkerType.ArrowClosed },
        selected: r.fromEntityId === selectedId || r.toEntityId === selectedId,
      })),
    [relationships, selectedId]
  )

  return (
    // Canvas math is physical; keep it LTR even in Arabic. Node text uses dir="auto".
    <div dir="ltr" style={{ height: "100%" }}>
      <ReactFlow<EntityNodeType, EvidenceEdgeType>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, n) => onSelect(n.id)}
        onSelectionChange={({ nodes: sel }) => {
          const id = sel[0]?.id
          if (id && id !== selectedId) onSelect(id)
        }}
        forceColorMode={resolvedTheme === "dark" ? "dark" : "light"}
        fitView
        fitViewOptions={fit}
        // Infinite-canvas feel: drag or two-finger scroll pans, pinch / ctrl+scroll zooms.
        panOnDrag
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        minZoom={0.1}
        maxZoom={2}
        nodesConnectable={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="var(--border)"
          bgColor="var(--background)"
        />
        <Controls showInteractive={false} />
        <FitOnFirstNodes count={nodes.length} options={fit} />
        {overlay && <Panel position="top-center">{overlay}</Panel>}
        {legend && <Panel position={locale === "ar" ? "top-right" : "top-left"}>{legend}</Panel>}
      </ReactFlow>
    </div>
  )
}
