import dagre from "@dagrejs/dagre"

import type { GraphEntity, GraphRelationship } from "@/lib/api/types"

export const NODE_W = 240
export const NODE_H = 64

/** Deterministic layered layout (sorted input → same output for the same graph). */
export function layoutGraph(entities: GraphEntity[], relationships: GraphRelationship[]) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: "LR", nodesep: 48, ranksep: 200, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))

  const ids = new Set(entities.map((e) => e.id))
  for (const e of [...entities].sort((a, b) => a.id.localeCompare(b.id)))
    g.setNode(e.id, { width: NODE_W, height: NODE_H })
  for (const r of [...relationships].sort((a, b) => a.id.localeCompare(b.id)))
    if (ids.has(r.fromEntityId) && ids.has(r.toEntityId)) g.setEdge(r.fromEntityId, r.toEntityId)

  dagre.layout(g)

  const pos = new Map<string, { x: number; y: number }>()
  for (const id of g.nodes()) {
    const n = g.node(id)
    pos.set(id, { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 })
  }
  return pos
}

const GAP = 24
const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H

/**
 * Incremental placement for streamed graphs. Existing nodes keep their
 * position exactly (including operator drags); only nodes without one get a
 * layered position, nudged down until they clear every placed node.
 */
export function placeNewNodes(
  existing: ReadonlyMap<string, { x: number; y: number }>,
  entities: GraphEntity[],
  relationships: GraphRelationship[]
) {
  const result = new Map<string, { x: number; y: number }>()
  for (const e of entities) {
    const p = existing.get(e.id)
    if (p) result.set(e.id, p)
  }
  const fresh = entities.filter((e) => !existing.has(e.id))
  if (fresh.length === 0) return result

  const layered = layoutGraph(entities, relationships)
  for (const e of [...fresh].sort((a, b) => a.id.localeCompare(b.id))) {
    let p = { ...(layered.get(e.id) ?? { x: 0, y: 0 }) }
    while ([...result.values()].some((o) => overlaps(o, p))) p = { x: p.x, y: p.y + NODE_H + GAP }
    result.set(e.id, p)
  }
  return result
}
