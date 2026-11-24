"use client"

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react"
import { Badge } from "@workspace/ui/components/badge"

import type { GraphRelationship } from "@/lib/api/types"
import { useLocale } from "@/lib/i18n"
import { Hint } from "../../hint"
import { INFERRED_DASH, NEUTRAL_EDGE, STRENGTH_STYLE } from "./edge-style"

export type EvidenceEdgeType = Edge<{ relationship: GraphRelationship }, "evidence">

/** Solid = observed; dashed = possible/disputed/unknown. Label hover shows the basis. */
export function EvidenceEdge(props: EdgeProps<EvidenceEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected, data } = props
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const r = data?.relationship
  const { locale, t } = useLocale()
  const observed = r?.support === "observed"
  const base = r?.strength ? STRENGTH_STYLE[r.strength] : NEUTRAL_EDGE

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? "var(--primary)" : base.color,
          strokeWidth: selected ? base.width + 1 : base.width,
          strokeDasharray: observed ? undefined : INFERRED_DASH,
        }}
      />
      {r && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            <Hint label={<span dir="auto">{r.rationaleVariants?.[locale] ?? r.rationale ?? r.kind}</span>}>
              <Badge variant="outline" tabIndex={0} style={{ background: "var(--background)" }}>
                {r.kind.replaceAll("_", " ")}{r.strength ? ` · ${t.network[r.strength]}` : ""}
              </Badge>
            </Hint>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
