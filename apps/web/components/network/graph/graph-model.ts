import Graph from "graphology"
import louvain from "graphology-communities-louvain"
import { polygonHull } from "d3"

import type { GraphEntity, GraphRelationship } from "@/lib/api/types"

export interface DotNode {
  id: string
  entity: GraphEntity
  degree: number
  community: number
}
export interface DotLink {
  id: string
  source: string
  target: string
  relationship: GraphRelationship
}
export interface DotGraph {
  nodes: DotNode[]
  links: DotLink[]
  /** community index → member node ids (largest first). */
  communities: string[][]
}

const WEIGHT = { strong: 3, medium: 2, weak: 1 } as const

/**
 * The data decides the structure. A backend may name a community on the entity
 * (`attributes.community`); otherwise communities are detected from the
 * relationships themselves (Louvain, weighted by link strength). Dangling
 * relationships (unknown endpoint) are dropped here, never drawn.
 */
export function buildDotGraph(entities: GraphEntity[], relationships: GraphRelationship[]): DotGraph {
  const ids = new Set(entities.map((e) => e.id))
  const links: DotLink[] = relationships
    .filter((r) => ids.has(r.fromEntityId) && ids.has(r.toEntityId) && r.fromEntityId !== r.toEntityId)
    .map((r) => ({ id: r.id, source: r.fromEntityId, target: r.toEntityId, relationship: r }))

  const g = new Graph({ type: "undirected", multi: false })
  for (const e of entities) g.addNode(e.id)
  for (const l of links) {
    const w = WEIGHT[l.relationship.strength ?? "weak"] ?? 1
    if (g.hasEdge(l.source, l.target)) g.updateEdgeAttribute(l.source, l.target, "weight", (v: number) => v + w)
    else g.addEdge(l.source, l.target, { weight: w })
  }

  const detected: Record<string, number> = g.size > 0 ? louvain(g, { getEdgeWeight: "weight", rng: seeded(7) }) : {}
  const declared = (e: GraphEntity) => {
    const c = e.attributes?.community
    return typeof c === "string" || typeof c === "number" ? String(c) : undefined
  }

  // Stable community numbering: by declared name or detected label, ordered by first entity id.
  const keyOf = (e: GraphEntity) => declared(e) ?? `d${detected[e.id] ?? 0}`
  const members = new Map<string, string[]>()
  for (const e of [...entities].sort((a, b) => a.id.localeCompare(b.id))) {
    const k = keyOf(e)
    members.set(k, [...(members.get(k) ?? []), e.id])
  }
  const ordered = [...members.values()].sort((a, b) => b.length - a.length || a[0]!.localeCompare(b[0]!))
  const indexOf = new Map<string, number>()
  ordered.forEach((ids2, i) => ids2.forEach((id) => indexOf.set(id, i)))

  const nodes: DotNode[] = entities.map((e) => ({
    id: e.id,
    entity: e,
    degree: g.degree(e.id),
    community: indexOf.get(e.id) ?? 0,
  }))
  return { nodes, links, communities: ordered }
}

/** Deterministic PRNG so the same data always yields the same communities. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const dotRadius = (degree: number) => 7 + Math.min(degree, 6) * 1.6

/**
 * Closed outline of a bubble around a community: the hull of points sampled on
 * a circle of `pad` around every member, so one dot becomes a circle, two a
 * capsule, many a smooth rounded hull.
 */
export function bubblePoints(
  members: { x: number; y: number; r: number }[],
  pad: number
): [number, number][] {
  const pts: [number, number][] = []
  for (const m of members)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      pts.push([m.x + Math.cos(a) * (m.r + pad), m.y + Math.sin(a) * (m.r + pad)])
    }
  return (polygonHull(pts) ?? pts) as [number, number][]
}
