import { describe, expect, it } from "vitest"

import { NODE_H, NODE_W, placeNewNodes } from "@/components/network/graph/layout"
import type { GraphEntity, GraphRelationship } from "@/lib/api/types"

const ent = (id: string): GraphEntity => ({ id, revision: 1, kind: "url", provenance: [] })
const rel = (id: string, from: string, to: string): GraphRelationship => ({
  id,
  revision: 1,
  kind: "link",
  fromEntityId: from,
  toEntityId: to,
  evidenceIds: [],
})
const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H

describe("placeNewNodes", () => {
  it("keeps every existing position exactly as it was", () => {
    const existing = new Map([
      ["a", { x: 500, y: 40 }],
      ["b", { x: 10, y: 10 }],
    ])
    const out = placeNewNodes(existing, [ent("a"), ent("b"), ent("c")], [rel("r1", "a", "c")])
    expect(out.get("a")).toEqual({ x: 500, y: 40 })
    expect(out.get("b")).toEqual({ x: 10, y: 10 })
    expect(out.has("c")).toBe(true)
  })

  it("never drops a new node on top of an existing one", () => {
    // dagre would put d at y=352 and e at y=464 — exactly where a and b already sit
    const existing = new Map([
      ["a", { x: 16, y: 352 }],
      ["b", { x: 16, y: 464 }],
      ["c", { x: 16, y: 16 }],
    ])
    const entities = ["a", "b", "c", "d", "e"].map(ent)
    const out = placeNewNodes(existing, entities, [])
    for (const id of ["d", "e"]) {
      for (const [other, pos] of out) if (other !== id) expect(overlaps(out.get(id)!, pos)).toBe(false)
    }
  })

  it("is deterministic", () => {
    const entities = ["a", "b", "c"].map(ent)
    const rels = [rel("r1", "a", "b"), rel("r2", "b", "c")]
    expect([...placeNewNodes(new Map(), entities, rels)]).toEqual([...placeNewNodes(new Map(), entities, rels)])
  })
})
