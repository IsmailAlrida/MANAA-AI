/**
 * Scripted scan runner: commits one reveal step per tick and publishes the
 * resulting upserts. All progress lives in the store, so a restarted process
 * resumes a running run where it stopped (`resumeRunning`).
 */
import type { Bus } from "./bus.ts"
import { mergeScanTicket } from "./domain/ticket.ts"
import {
  EVENT_FOR_KIND,
  SSE_EVENT,
  runStatusDto,
  stableStringify,
  upsertDto,
  withoutKeys,
  type ArtifactData,
  type RunRecord,
} from "./domain/types.ts"
import type { PlanStep, RevealPlan } from "./fixtures/plan.ts"
import type { ArtifactMutation, Store } from "./store/store.ts"

export interface Runner {
  start(input: {
    idempotencyKey: string | null
    requestText: string | null
  }): Promise<{
    run: RunRecord
    created: boolean
  }>
  /** Apply the next step of a running run. Exposed for tests and manual driving. */
  step(runId: string): Promise<RunRecord | null>
  /** Reschedule every run left `running` by a previous process. */
  resumeRunning(): Promise<void>
  /** Stop scheduling, drain an active reveal step, then persist paused state. */
  pause(runId: string): Promise<RunRecord | null>
  /** Continue the same run cursor after a persisted pause. */
  resume(runId: string): Promise<RunRecord | null>
  /** Cancel pending timers (shutdown or demo reset). In-flight steps fail their CAS harmlessly. */
  stopAll(): void
}

export interface RunnerOptions {
  store: Store
  bus: Bus
  plan: RevealPlan
  /** Load a run-specific plan after its durable run ID has been allocated. */
  prepareRun?: (input: {
    runId: string
    requestText: string | null
  }) => Promise<RevealPlan>
  stepMs: number
  now?: () => Date
  newRunId?: () => string
  /** When false, steps only advance via `step()`; used by tests. */
  autoSchedule?: boolean
  log?: (message: string, err?: unknown) => void
}

/** Replace scan-owned graph records; `null` (no write) when content is unchanged. */
function replaceIfChanged(next: ArtifactData) {
  return (current: ArtifactData | null) =>
    current &&
    stableStringify(withoutKeys(current, ["revision"])) ===
      stableStringify(next)
      ? null
      : next
}

function mutationsFor(step: PlanStep, now: string): ArtifactMutation[] {
  return [
    ...step.entities.map((e) => ({
      kind: "entity" as const,
      id: e.id,
      mutate: replaceIfChanged(e),
    })),
    ...step.relationships.map((r) => ({
      kind: "relationship" as const,
      id: r.id,
      mutate: replaceIfChanged(r),
    })),
    ...step.tickets.map((t) => ({
      kind: "ticket" as const,
      id: t.data.id,
      mutate: (current: ArtifactData | null) =>
        mergeScanTicket(current, t.data, { complete: t.complete, now }),
    })),
  ]
}

export function createRunner(options: RunnerOptions): Runner {
  const { store, bus, plan, stepMs } = options
  const now = options.now ?? (() => new Date())
  const newRunId =
    options.newRunId ?? (() => `run_${crypto.randomUUID().replaceAll("-", "")}`)
  const autoSchedule = options.autoSchedule ?? true
  const log =
    options.log ??
    ((message, err) => console.error(`[runner] ${message}`, err ?? ""))
  const timers = new Map<string, NodeJS.Timeout>()
  const plans = new Map<string, RevealPlan>()
  const inFlight = new Map<string, Promise<RunRecord | null>>()
  const pauseRequested = new Set<string>()

  const publishRun = (run: RunRecord) =>
    bus.publish({
      type: SSE_EVENT.run,
      runId: run.runId,
      payload: runStatusDto(run),
    })

  async function preparePlan(run: RunRecord): Promise<boolean> {
    if (!options.prepareRun || plans.has(run.runId)) return true
    try {
      const prepared = await options.prepareRun({
        runId: run.runId,
        requestText: run.requestText,
      })
      if (prepared.steps.length !== run.total) {
        const failed = await store.failRun(
          run.runId,
          {
            code: "scenario_changed",
            message:
              "The controlled result changed while this run was in progress.",
          },
          now().toISOString()
        )
        if (failed) publishRun(failed)
        return false
      }
      plans.set(run.runId, prepared)
      return true
    } catch (err) {
      log(`could not restore run plan for ${run.runId}`, err)
      const failed = await store.failRun(
        run.runId,
        {
          code: "investigation_failed",
          message: "The controlled investigation could not be restored.",
        },
        now().toISOString()
      )
      if (failed) publishRun(failed)
      return false
    }
  }

  async function step(runId: string): Promise<RunRecord | null> {
    const run = await store.getRun(runId)
    if (!run || run.status !== "running") return run

    const runPlan = plans.get(runId) ?? plan
    const planStep = runPlan.steps[run.completed]
    if (!planStep || run.total !== runPlan.steps.length) {
      const failed = await store.failRun(
        runId,
        {
          code: "scenario_changed",
          message:
            "The scenario changed while this run was in progress. Reset and start a new scan.",
        },
        now().toISOString()
      )
      if (failed) publishRun(failed)
      return failed
    }

    const result = await store.applyRevealStep({
      runId,
      expectedCompleted: run.completed,
      mutations: mutationsFor(planStep, now().toISOString()),
      now: now().toISOString(),
    })
    if (!result.applied) return result.run

    for (const record of result.changed) {
      bus.publish({
        type: EVENT_FOR_KIND[record.kind],
        payload: upsertDto(record),
      })
    }
    if (result.run) publishRun(result.run)
    return result.run
  }

  async function executeStep(runId: string) {
    const pending = step(runId)
    inFlight.set(runId, pending)
    try {
      return await pending
    } finally {
      if (inFlight.get(runId) === pending) inFlight.delete(runId)
    }
  }

  function schedule(runId: string) {
    if (!autoSchedule || timers.has(runId)) return
    const timer = setTimeout(async () => {
      timers.delete(runId)
      try {
        const run = await executeStep(runId)
        if (run?.status === "running" && !pauseRequested.has(runId))
          schedule(runId)
      } catch (err) {
        log(`step failed for ${runId}`, err)
        const failed = await store
          .failRun(
            runId,
            {
              code: "internal_error",
              message: "The scan stopped unexpectedly.",
            },
            now().toISOString()
          )
          .catch(() => null)
        if (failed) publishRun(failed)
      }
    }, stepMs)
    timers.set(runId, timer)
  }

  return {
    async start({ idempotencyKey, requestText }) {
      // A placeholder count allows the store to allocate/reuse the durable run
      // before external work starts. Engine plans currently publish atomically
      // as one committed reveal; fixture mode retains its existing step count.
      const result = await store.createRun({
        runId: newRunId(),
        idempotencyKey,
        requestText,
        total: options.prepareRun ? 1 : plan.steps.length,
        now: now().toISOString(),
      })
      if (result.created) publishRun(result.run)
      if (result.created && options.prepareRun) {
        try {
          const prepared = await options.prepareRun({
            runId: result.run.runId,
            requestText: result.run.requestText,
          })
          if (prepared.steps.length !== result.run.total) {
            throw new Error(
              "Prepared run plan does not match durable run total"
            )
          }
          plans.set(result.run.runId, prepared)
        } catch (err) {
          const failed = await store.failRun(
            result.run.runId,
            {
              code: "investigation_failed",
              message: "The controlled investigation could not be prepared.",
            },
            now().toISOString()
          )
          if (failed) publishRun(failed)
          throw err
        }
      }
      if (result.run.status === "running") schedule(result.run.runId)
      return result
    },
    step,
    async pause(runId) {
      pauseRequested.add(runId)
      const timer = timers.get(runId)
      if (timer) clearTimeout(timer)
      timers.delete(runId)
      const active = inFlight.get(runId)
      if (active) await active
      const run = await store.pauseRun(runId, now().toISOString())
      if (run) publishRun(run)
      return run
    },
    async resume(runId) {
      const beforeResume = await store.getRun(runId)
      if (
        beforeResume?.status === "paused" &&
        !(await preparePlan(beforeResume))
      ) {
        return store.getRun(runId)
      }
      const run = await store.resumeRun(runId, now().toISOString())
      if (run?.status === "running") {
        pauseRequested.delete(runId)
        publishRun(run)
        schedule(runId)
      }
      return run
    },
    async resumeRunning() {
      for (const run of await store.runningRuns()) {
        if (!(await preparePlan(run))) continue
        schedule(run.runId)
      }
    },
    stopAll() {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    },
  }
}
