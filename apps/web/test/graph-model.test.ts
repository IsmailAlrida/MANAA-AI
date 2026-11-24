import { describe, expect, it } from "vitest"

import { bubblePoints, buildDotGraph, dotRadius } from "@/components/network/graph/graph-model"
import type { GraphEntity, GraphRelationship } from "@/lib/api/types"

const ent = (id: string, attributes?: Record<string, unknown>): GraphEntity => ({ id, revision: 1, kind: "url", provenance: [], attributes })
const rel = (id: string, from: string, to: string, strength?: "strong" | "medium" | "weak"): GraphRelationship => ({
  id, revision: 1, kind: "link", fromEntityId: from, toEntityId: to, strength, evidenceIds: [],
})

describe("buildDotGraph", () => {
  const two = [
    ["a1", "a2", "a3"],
    ["b1", "b2", "b3"],
  ]
  const entities = two.flat().map((id) => ent(id))
  const rels = [
    rel("r1", "a1", "a2", "strong"), rel("r2", "a2", "a3", "strong"), rel("r3", "a1", "a3", "strong"),
    rel("r4", "b1", "b2", "strong"), rel("r5", "b2", "b3", "strong"), rel("r6", "b1", "b3", "strong"),
    rel("bridge", "a3", "b1", "weak"),
  ]

  it("finds the two dense groups from the relationships alone", () => {
    const g = buildDotGraph(entities, rels)
    expect(g.communities).toHaveLength(2)
    const comm = (id: string) => g.nodes.find((n) => n.id === id)!.community
    expect(new Set(["a1", "a2", "a3"].map(comm)).size).toBe(1)
    expect(new Set(["b1", "b2", "b3"].map(comm)).size).toBe(1)
    expect(comm("a1")).not.toBe(comm("b1"))
  })

  it("is deterministic for the same data", () => {
    expect(buildDotGraph(entities, rels).communities).toEqual(buildDotGraph(entities, rels).communities)
  })

  it("prefers a community the backend declares on the entity", () => {
    const declared = entities.map((e) => ent(e.id, { community: e.id.startsWith("a") ? "ring-1" : "ring-1" }))
    expect(buildDotGraph(declared, rels).communities).toHaveLength(1)
  })

  it("drops dangling and self relationships instead of drawing them", () => {
    const g = buildDotGraph([ent("a"), ent("b")], [rel("ok", "a", "b"), rel("dangling", "a", "ghost"), rel("self", "a", "a")])
    expect(g.links.map((l) => l.id)).toEqual(["ok"])
  })

  it("keeps isolated entities as their own community", () => {
    const g = buildDotGraph([ent("a"), ent("b"), ent("lonely")], [rel("r", "a", "b")])
    expect(g.nodes.find((n) => n.id === "lonely")!.degree).toBe(0)
    expect(g.communities.flat().sort()).toEqual(["a", "b", "lonely"])
  })

  it("handles an empty graph", () => {
    expect(buildDotGraph([], [])).toEqual({ nodes: [], links: [], communities: [] })
  })

  it("sizes dots by degree within bounds", () => {
    expect(dotRadius(0)).toBeLessThan(dotRadius(3))
    expect(dotRadius(50)).toBe(dotRadius(6))
  })
})

describe("bubblePoints", () => {
  it("encloses every member with the padding", () => {
    const pts = bubblePoints([{ x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 10 }], 20)
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
    expect(Math.min(...xs)).toBeLessThanOrEqual(-30 + 1)
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(130 - 1)
    expect(Math.min(...ys)).toBeLessThanOrEqual(-30 + 1)
  })
  it("works for a single dot", () => {
    expect(bubblePoints([{ x: 5, y: 5, r: 8 }], 12).length).toBeGreaterThanOrEqual(3)
  })
})
