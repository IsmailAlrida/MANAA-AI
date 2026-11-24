import { describe, expect, it } from "vitest"

import { kindStyle, LEGEND_KINDS } from "@/components/network/graph/kind-icon"
import { safeImageUrl } from "@/lib/api/types"

describe("kindStyle", () => {
  it("tells the five headline kinds apart by shape or glyph, not only colour", () => {
    const kinds = ["person", "company", "server", "transaction", "url"] as const
    const sig = kinds.map((k) => `${kindStyle(k).shape}:${kindStyle(k).Icon.displayName}`)
    expect(new Set(sig).size).toBe(kinds.length)
  })

  it("gives a person a circle, a company a square, a server a hexagon, a transaction a diamond", () => {
    expect(kindStyle("person").shape).toBe("circle")
    expect(kindStyle("company").shape).toBe("square")
    expect(kindStyle("server").shape).toBe("hexagon")
    expect(kindStyle("transaction").shape).toBe("diamond")
  })

  it("falls back to a neutral style for unknown kinds instead of throwing", () => {
    const s = kindStyle("something_new")
    expect(s.shape).toBe("circle")
    expect(s.group).toBe("infra")
  })

  it("legend kinds each resolve to a real style", () => {
    for (const k of LEGEND_KINDS) expect(kindStyle(k).Icon).toBeDefined()
  })
})

describe("safeImageUrl", () => {
  it("accepts same-origin API asset paths only", () => {
    expect(safeImageUrl("/api/v1/assets/ENT-PERSON-1/photo.png")).toBe("/api/v1/assets/ENT-PERSON-1/photo.png")
  })
  it.each([
    "https://evil.example/x.png",
    "//evil.example/x.png",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg/>",
    "/api/v1/../secret",
    "/other/path.png",
    "",
  ])("rejects %s", (u) => expect(safeImageUrl(u)).toBeUndefined())
  it("handles undefined", () => expect(safeImageUrl(undefined)).toBeUndefined())
})
