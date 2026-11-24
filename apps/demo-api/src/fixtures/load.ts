/**
 * Loads the generated fictional scenario (demo/fixtures/generated). The demo
 * backend treats it as opaque scan output: it reads the final workspace, the
 * evidence reveal order, and the static source cards, and nothing else.
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { ArtifactData } from "../domain/types.ts"

export interface Fixtures {
  workspaceId: string
  entities: ArtifactData[]
  relationships: ArtifactData[]
  tickets: ArtifactData[]
  /** Evidence IDs in scripted discovery order. */
  revealOrder: string[]
  /** Evidence ID → static Markdown source card. */
  sources: Map<string, string>
}

const SAFE_ID = /^[A-Za-z0-9_-]+$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The contract requires RFC 3339 timestamps with an offset; fixtures carry
 * date-only proposals. Treat them as end of day, Gulf Standard Time.
 */
export function normalizeClosingDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  return DATE_ONLY.test(value) ? `${value}T23:59:59+04:00` : value
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (err) {
    throw new Error(`Cannot read fixture ${path}: ${(err as Error).message}`)
  }
}

function records(value: unknown, label: string): ArtifactData[] {
  if (!Array.isArray(value))
    throw new Error(`Fixture ${label} must be an array`)
  return value.map((row, i) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof (row as { id?: unknown }).id !== "string"
    ) {
      throw new Error(`Fixture ${label}[${i}] has no string id`)
    }
    return row as ArtifactData
  })
}

export function loadFixtures(dir: string): Fixtures {
  const workspace = readJson(join(dir, "workspace.json")) as Record<
    string,
    unknown
  >
  const timeline = readJson(join(dir, "backend-reveal-timeline.json")) as {
    events?: unknown
  }

  const events = Array.isArray(timeline.events) ? timeline.events : []
  const revealOrder = events
    .map((e) => e as { at?: unknown; evidenceId?: unknown })
    .filter(
      (e): e is { at: string; evidenceId: string } =>
        typeof e.at === "string" && typeof e.evidenceId === "string"
    )
    .sort((a, b) =>
      a.at === b.at
        ? a.evidenceId.localeCompare(b.evidenceId)
        : a.at.localeCompare(b.at)
    )
    .map((e) => e.evidenceId)
  if (revealOrder.length === 0)
    throw new Error("Fixture timeline has no evidence events")

  const sources = new Map<string, string>()
  for (const id of revealOrder) {
    if (!SAFE_ID.test(id))
      throw new Error(`Unsafe evidence id in timeline: ${id}`)
    const path = join(dir, "sources", `${id}.md`)
    if (existsSync(path)) sources.set(id, readFileSync(path, "utf8"))
  }

  const tickets = records(workspace.tickets, "tickets").map((t) => ({
    ...t,
    closingDate: normalizeClosingDate(t.closingDate),
  }))

  return {
    workspaceId:
      typeof workspace.workspaceId === "string"
        ? workspace.workspaceId
        : "workspace-demo",
    entities: records(workspace.entities, "entities"),
    relationships: records(workspace.relationships, "relationships"),
    tickets,
    revealOrder,
    sources,
  }
}
