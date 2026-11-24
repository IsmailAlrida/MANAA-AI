import { describe, expect, it } from "vitest"

import { upsert, upsertMany } from "@/lib/workspace/merge"

const rec = (id: string, revision: number, v = "x") => ({ id, revision, v })

describe("upsert", () => {
  it("adds new records", () => {
    expect(upsert({}, rec("a", 1))).toEqual({ a: rec("a", 1) })
  })
  it("replaces with a higher revision", () => {
    expect(upsert({ a: rec("a", 1) }, rec("a", 2, "new")).a?.v).toBe("new")
  })
  it("never lets an older or equal revision overwrite", () => {
    const map = { a: rec("a", 3, "keep") }
    expect(upsert(map, rec("a", 2, "stale"))).toBe(map)
    expect(upsert(map, rec("a", 3, "dupe"))).toBe(map)
  })
  it("upsertMany merges snapshot rows by id and revision", () => {
    const out = upsertMany({ a: rec("a", 2, "live") }, [rec("a", 1, "snap"), rec("b", 1)])
    expect(out.a?.v).toBe("live")
    expect(out.b).toBeDefined()
  })
})
