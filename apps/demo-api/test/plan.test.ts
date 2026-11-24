import assert from "node:assert/strict"
import { test } from "node:test"
import { stableStringify, stringArray } from "../src/domain/types.ts"
import { buildRevealPlan } from "../src/fixtures/plan.ts"
import { fixtures, plan } from "./harness.ts"

test("one step per revealed evidence item, deterministic", () => {
  assert.equal(plan.steps.length, fixtures.revealOrder.length)
  assert.equal(
    stableStringify(buildRevealPlan(fixtures)),
    stableStringify(plan)
  )
})

test("every reference is emitted before it is used", () => {
  const entities = new Set<string>()
  const relationships = new Set<string>()
  const evidence = new Set<string>()
  for (const step of plan.steps) {
    evidence.add(step.evidenceId)
    for (const e of step.entities) entities.add(e.id)
    for (const r of step.relationships) {
      assert.ok(
        entities.has(String(r.fromEntityId)) &&
          entities.has(String(r.toEntityId)),
        `${r.id} endpoints`
      )
      for (const id of stringArray(r.evidenceIds))
        assert.ok(evidence.has(id), `${r.id} cites unrevealed ${id}`)
      relationships.add(r.id)
    }
    for (const { data } of step.tickets) {
      for (const id of stringArray(data.entityIds))
        assert.ok(entities.has(id), `${data.id} → ${id}`)
      for (const id of stringArray(data.relationshipIds))
        assert.ok(relationships.has(id), `${data.id} → ${id}`)
      for (const id of stringArray(data.evidenceIds))
        assert.ok(evidence.has(id), `${data.id} → ${id}`)
    }
  }
})

test("the final step of each ticket is the complete fixture report", () => {
  const last = new Map<
    string,
    { complete: boolean; data: Record<string, unknown> }
  >()
  for (const step of plan.steps)
    for (const t of step.tickets) last.set(t.data.id, t)
  assert.equal(last.size, fixtures.tickets.length)
  for (const fixture of fixtures.tickets) {
    const view = last.get(fixture.id)!
    assert.equal(view.complete, true)
    assert.equal(view.data.reportMarkdown, fixture.reportMarkdown)
    assert.deepEqual(view.data.evidenceIds, fixture.evidenceIds)
    assert.deepEqual(view.data.blocks, fixture.blocks)
  }
})

test("incomplete tickets never cite unrevealed evidence in blocks", () => {
  const revealed = new Set<string>()
  for (const step of plan.steps) {
    revealed.add(step.evidenceId)
    for (const { data, complete } of step.tickets) {
      if (complete) continue
      for (const block of data.blocks as Array<Record<string, unknown>>) {
        if (block.type === "evidence")
          assert.ok(revealed.has(String(block.evidenceId)))
      }
    }
  }
})

test("rejects a fixture whose ticket cites evidence that is never revealed", () => {
  const broken = {
    ...fixtures,
    tickets: [{ ...fixtures.tickets[0]!, evidenceIds: ["EV-NOT-REAL"] }],
  }
  assert.throws(() => buildRevealPlan(broken), /never revealed/)
})

test("priority and summary are withheld until the report is published", () => {
  for (const step of plan.steps) {
    for (const { data, complete } of step.tickets) {
      if (complete) {
        const fixture = fixtures.tickets.find((t) => t.id === data.id)!
        assert.deepEqual(data.priority, fixture.priority)
        assert.ok((data.priority as { reason?: string }).reason)
      } else {
        assert.equal(data.priority, undefined)
        assert.equal(data.summary, undefined)
        assert.equal(data.contentVariants, undefined)
      }
    }
  }
})


test("paired report variants and source-backed names stay withheld until complete evidence is revealed", () => {
  const revealed = new Set<string>()
  for (const step of plan.steps) {
    revealed.add(step.evidenceId)
    for (const { data, complete } of step.tickets) {
      if (complete) {
        const variants = data.contentVariants as Record<string, Record<string, unknown>>
        assert.deepEqual(Object.keys(variants).sort(), ["ar", "en"])
      } else {
        assert.equal(data.contentVariants, undefined)
      }
    }
    for (const entity of step.entities) {
      for (const variant of (entity.nameVariants ?? []) as Array<{ evidenceIds: string[] }>)
        for (const evidenceId of variant.evidenceIds)
          assert.ok(revealed.has(evidenceId), `${String(entity.id)} leaks ${evidenceId}`)
    }
  }
})


test("entity dossiers are withheld until all dossier provenance is revealed", () => {
  const revealed = new Set<string>()
  for (const step of plan.steps) {
    revealed.add(step.evidenceId)
    for (const entity of step.entities) {
      const sourceEntity = fixtures.entities.find((candidate) => candidate.id === entity.id)!
      const provenance = sourceEntity.provenance as Array<{ evidenceId: string }>
      const complete = provenance.length > 0 && provenance.every((ref) => revealed.has(ref.evidenceId))
      assert.equal(Boolean(entity.dossierVariants), complete)
    }
  }
})
