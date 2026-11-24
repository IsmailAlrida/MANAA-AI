/**
 * Derives the scripted "grand reveal" from the final fixture workspace.
 *
 * One step per evidence item, in timeline order. Each step contains, in
 * contract emit order:
 *   1. entities whose provenance gained the new evidence (provenance trimmed
 *      to what has been revealed so far);
 *   2. relationships whose evidence is fully revealed and whose endpoints exist;
 *   3. tickets that have started and whose visible view changed.
 * A ticket shows a collection-status note until all of its evidence is in,
 * then the full report. Nothing here knows scenario IDs; any fixture that
 * satisfies the generator's contract replays the same way.
 */
import {
  stableStringify,
  stringArray,
  withoutKeys,
  type ArtifactData,
} from "../domain/types.ts"
import type { Fixtures } from "./load.ts"

export interface PlanTicketView {
  data: ArtifactData
  /** True once every cited evidence item has been revealed. */
  complete: boolean
}

export interface PlanStep {
  evidenceId: string
  entities: ArtifactData[]
  relationships: ArtifactData[]
  tickets: PlanTicketView[]
}

export interface RevealPlan {
  workspaceId: string
  steps: PlanStep[]
}

/** Lifecycle fields owned by the backend/operator, never by the fixture. */
const TICKET_LIFECYCLE = [
  "revision",
  "status",
  "createdAt",
  "updatedAt",
  "history",
  "finalWriteup",
  "closedAt",
]

/** Fixture fields that belong to the finished assessment, withheld while collecting. */
const ASSESSMENT_FIELDS = ["priority", "summary", "contentVariants"]

const COLLECTING_NOTE =
  "Collection in progress. Captured public sources are listed below; the assessment is published when collection for this campaign completes."

function provenanceIds(entity: ArtifactData): string[] {
  const rows = Array.isArray(entity.provenance) ? entity.provenance : []
  return rows
    .map((p) =>
      p && typeof p === "object"
        ? (p as { evidenceId?: unknown }).evidenceId
        : undefined
    )
    .filter((id): id is string => typeof id === "string")
}

function entityView(entity: ArtifactData, revealed: Set<string>): ArtifactData {
  const provenance = (
    Array.isArray(entity.provenance) ? entity.provenance : []
  ).filter((p) => {
    const id =
      p && typeof p === "object"
        ? (p as { evidenceId?: unknown }).evidenceId
        : undefined
    return typeof id !== "string" || revealed.has(id)
  })
  const allProvenanceIds = provenanceIds(entity)
  const dossierComplete = allProvenanceIds.length > 0 && allProvenanceIds.every((id) => revealed.has(id))
  const safe = withoutKeys(entity, ["revision"]) as ArtifactData
  const nameVariants = Array.isArray(entity.nameVariants)
    ? entity.nameVariants.filter((variant) => {
        if (!variant || typeof variant !== "object") return false
        const ids = stringArray((variant as { evidenceIds?: unknown }).evidenceIds)
        return ids.length > 0 && ids.every((id) => revealed.has(id))
      })
    : undefined
  return {
    ...safe,
    provenance,
    ...(nameVariants ? { nameVariants } : {}),
    ...(dossierComplete ? {} : { dossierVariants: undefined }),
  }
}

function blockVisible(
  block: unknown,
  revealed: Set<string>,
  complete: boolean
): boolean {
  if (!block || typeof block !== "object") return false
  const b = block as {
    type?: unknown
    evidenceId?: unknown
    evidenceIds?: unknown
  }
  if (complete) return true
  if (b.type === "markdown") return false
  if (b.type === "evidence")
    return typeof b.evidenceId === "string" && revealed.has(b.evidenceId)
  const refs = stringArray(b.evidenceIds)
  return refs.length > 0 && refs.every((id) => revealed.has(id))
}

function ticketView(
  ticket: ArtifactData,
  revealed: Set<string>,
  emittedEntities: Set<string>,
  emittedRelationships: Set<string>
): PlanTicketView {
  const evidenceIds = stringArray(ticket.evidenceIds)
  const complete = evidenceIds.every((id) => revealed.has(id))
  const blocks = (Array.isArray(ticket.blocks) ? ticket.blocks : []).filter(
    (b) => blockVisible(b, revealed, complete)
  )
  const base = withoutKeys(ticket, TICKET_LIFECYCLE) as ArtifactData
  const view: ArtifactData = {
    ...base,
    evidenceIds: evidenceIds.filter((id) => revealed.has(id)),
    entityIds: stringArray(ticket.entityIds).filter((id) =>
      emittedEntities.has(id)
    ),
    relationshipIds: stringArray(ticket.relationshipIds).filter((id) =>
      emittedRelationships.has(id)
    ),
    blocks: complete
      ? blocks
      : [
          {
            id: `${ticket.id}:collection-status`,
            type: "markdown",
            text: COLLECTING_NOTE,
          },
          ...blocks,
        ],
  }
  if (!complete) {
    view.reportMarkdown = COLLECTING_NOTE
    // The assessment (priority, summary) is published with the report; its
    // reasons may cite evidence that has not been revealed yet.
    for (const key of ASSESSMENT_FIELDS) delete view[key]
  }
  return { data: view, complete }
}

export function buildRevealPlan(fixtures: Fixtures): RevealPlan {
  const problems: string[] = []
  const revealed = new Set<string>()
  const emittedEntities = new Set<string>()
  const emittedRelationships = new Set<string>()
  const lastTicketView = new Map<string, string>()
  const known = new Set(fixtures.revealOrder)

  for (const t of fixtures.tickets) {
    for (const id of stringArray(t.evidenceIds)) {
      if (!known.has(id))
        problems.push(
          `ticket ${t.id} cites evidence ${id} that is never revealed`
        )
    }
  }
  for (const r of fixtures.relationships) {
    const ids = stringArray(r.evidenceIds)
    if (ids.length === 0)
      problems.push(`relationship ${r.id} cites no evidence`)
    for (const id of ids)
      if (!known.has(id))
        problems.push(`relationship ${r.id} cites unrevealed ${id}`)
  }
  if (problems.length)
    throw new Error(`Fixture cannot be replayed:\n- ${problems.join("\n- ")}`)

  const steps: PlanStep[] = []
  for (const evidenceId of fixtures.revealOrder) {
    revealed.add(evidenceId)
    const step: PlanStep = {
      evidenceId,
      entities: [],
      relationships: [],
      tickets: [],
    }

    for (const entity of fixtures.entities) {
      if (provenanceIds(entity).includes(evidenceId)) {
        step.entities.push(entityView(entity, revealed))
        emittedEntities.add(entity.id)
      }
    }

    for (const rel of fixtures.relationships) {
      if (emittedRelationships.has(rel.id)) continue
      const ready =
        stringArray(rel.evidenceIds).every((id) => revealed.has(id)) &&
        emittedEntities.has(String(rel.fromEntityId)) &&
        emittedEntities.has(String(rel.toEntityId))
      if (ready) {
        step.relationships.push(withoutKeys(rel, ["revision"]) as ArtifactData)
        emittedRelationships.add(rel.id)
      }
    }

    for (const ticket of fixtures.tickets) {
      const started = stringArray(ticket.evidenceIds).some((id) =>
        revealed.has(id)
      )
      if (!started) continue
      const view = ticketView(
        ticket,
        revealed,
        emittedEntities,
        emittedRelationships
      )
      const key = stableStringify(view.data)
      if (lastTicketView.get(ticket.id) === key) continue
      lastTicketView.set(ticket.id, key)
      step.tickets.push(view)
    }

    steps.push(step)
  }

  const missing = [
    ...fixtures.entities
      .filter((e) => !emittedEntities.has(e.id))
      .map((e) => `entity ${e.id}`),
    ...fixtures.relationships
      .filter((r) => !emittedRelationships.has(r.id))
      .map((r) => `relationship ${r.id}`),
    ...fixtures.tickets
      .filter((t) => !lastTicketView.has(t.id))
      .map((t) => `ticket ${t.id}`),
  ]
  if (missing.length)
    throw new Error(`Fixture reveal never emits: ${missing.join(", ")}`)

  return { workspaceId: fixtures.workspaceId, steps }
}
