/**
 * Agent adapter seam: where investigation results enter the backend.
 *
 * A real agent integration implements this interface and translates its
 * findings into the same reveal plan (ticket and graph upserts). Everything
 * else — store, runner, SSE, REST — stays unchanged.
 *
 * `createFixtureAdapter` is the stub: it replays the generated fictional
 * scenario and performs no investigation, network access, or LLM call.
 */
import { loadFixtures } from "./fixtures/load.ts"
import { buildRevealPlan, type RevealPlan } from "./fixtures/plan.ts"

export interface AgentAdapter {
  readonly name: string
  /** Produce the reveal plan for a scan. Called once at backend startup. */
  loadPlan(): Promise<{ plan: RevealPlan; sources: Map<string, string> }>
}

export function createFixtureAdapter(fixturesDir: string): AgentAdapter {
  return {
    name: "fixture-stub",
    async loadPlan() {
      const fixtures = loadFixtures(fixturesDir)
      return { plan: buildRevealPlan(fixtures), sources: fixtures.sources }
    },
  }
}
