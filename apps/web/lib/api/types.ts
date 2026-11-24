/**
 * v1 contract DTOs — mirrors docs/FRONTEND-BACKEND-CONTRACT.md.
 * Schemas are loose so additive backend fields are tolerated.
 * Nothing here is scenario-specific; the demo and real backends share it.
 */
import { z } from "zod"

export const supportSchema = z.string() // observed | possible | disputed | (future values)
export type Support = z.infer<typeof supportSchema>

const evidenceRefSchema = z.looseObject({ evidenceId: z.string() })

const assetRefSchema = z.looseObject({
  url: z.string(),
  mimeType: z.string().optional(),
  byteLength: z.number().optional(),
  sha256: z.string().optional(),
  scope: z.string().optional(),
})
export type AssetRef = z.infer<typeof assetRefSchema>

/* ---------- graph ---------- */

const localizedTextSchema = z.looseObject({
  title: z.string().optional(),
  summary: z.string().optional(),
  priorityReason: z.string().optional(),
  uncertainty: z.string().optional(),
  reportMarkdown: z.string().optional(),
  blockTextById: z.record(z.string(), z.unknown()).optional(),
})
const dossierFieldSchema = z.looseObject({
  label: z.string(),
  value: z.string(),
  evidenceIds: z.array(z.string()).default([]),
})
const dossierSchema = z.looseObject({
  summary: z.string(),
  fields: z.array(dossierFieldSchema).default([]),
})
const nameVariantSchema = z.looseObject({
  value: z.string(),
  languageTag: z.string(),
  evidenceIds: z.array(z.string()),
  sourceReference: z.string(),
})

export const entitySchema = z.looseObject({
  id: z.string(),
  revision: z.number(),
  kind: z.string(), // unknown kinds render as generic inspectable records
  label: z.string().optional(),
  labelVariants: z.record(z.string(), z.string()).optional(),
  nameVariants: z.array(nameVariantSchema).optional(),
  dossierVariants: z.record(z.enum(["en", "ar"]), dossierSchema).optional(),
  // Optional header image for the entity (a face, a logo, a screenshot thumbnail). Same-origin asset path only.
  image: z.looseObject({ url: z.string(), alt: z.string().optional() }).optional(),
  observedAt: z.string().optional(),
  support: supportSchema.optional(),
  uncertainty: z.string().nullable().optional(),
  provenance: z.array(evidenceRefSchema).default([]),
  attributes: z.record(z.string(), z.unknown()).optional(),
})
export type GraphEntity = z.infer<typeof entitySchema>

export const relationshipSchema = z.looseObject({
  id: z.string(),
  revision: z.number(),
  kind: z.string(),
  fromEntityId: z.string(),
  toEntityId: z.string(),
  support: supportSchema.optional(),
  rationale: z.string().optional(),
  rationaleVariants: z.record(z.string(), z.string()).optional(),
  strength: z.enum(["strong", "medium", "weak"]).optional(),
  observedAt: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
})
export type GraphRelationship = z.infer<typeof relationshipSchema>

/* ---------- report blocks ---------- */

export const blockSchema = z.looseObject({
  id: z.string(),
  type: z.string(), // markdown | evidence | plot | comparison | (unknown → generic)
  // markdown
  text: z.string().optional(),
  // evidence
  evidenceId: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  sourceReference: z.string().optional(),
  capturedAt: z.string().optional(),
  collectionMethod: z.string().optional(),
  language: z.string().optional(),
  support: supportSchema.optional(),
  asset: assetRefSchema.optional(),
  evidenceIds: z.array(z.string()).optional(),
})
export type ReportBlock = z.infer<typeof blockSchema>

/* ---------- tickets ---------- */

export const ticketStatusSchema = z.enum(["open", "closed"])
export type TicketStatus = z.infer<typeof ticketStatusSchema>

const historyEntrySchema = z.looseObject({
  at: z.string(),
  kind: z.string(),
  actor: z.string().optional(),
  note: z.string().optional(),
})
export type TicketHistoryEntry = z.infer<typeof historyEntrySchema>

export const ticketSchema = z.looseObject({
  id: z.string(),
  revision: z.number(),
  title: z.string(),
  status: ticketStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  closingDate: z.string().nullable().optional(),
  reportMarkdown: z.string().optional(),
  contentVariants: z.record(z.enum(["en", "ar"]), localizedTextSchema).optional(),
  blocks: z.array(blockSchema).default([]),
  entityIds: z.array(z.string()).default([]),
  relationshipIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  // Contract gaps (PRD requires these; written contract/fixtures don't yet carry them):
  priority: z
    .looseObject({
      level: z.string(),
      reason: z.string().optional(),
      evidenceIds: z.array(z.string()).optional(),
    })
    .optional(),
  summary: z.string().optional(),
  history: z.array(historyEntrySchema).optional(),
  finalWriteup: z.string().optional(),
})
export type Ticket = z.infer<typeof ticketSchema>

export function ticketText(ticket: Ticket, locale: "en" | "ar") {
  const variant = ticket.contentVariants?.[locale]
  return {
    title: variant?.title ?? ticket.title,
    summary: variant?.summary ?? ticket.summary,
    priorityReason: variant?.priorityReason ?? ticket.priority?.reason,
    reportMarkdown: variant?.reportMarkdown ?? ticket.reportMarkdown,
    blocks: ticket.blocks.map((block) => {
      const copy = variant?.blockTextById?.[block.id]
      if (!copy || typeof copy !== "object") return block
      return { ...block, ...(copy as Partial<ReportBlock>) }
    }),
  }
}

/** Only same-origin API asset paths are ever loaded as images; anything else is ignored. */
export function safeImageUrl(url: string | undefined) {
  return url && /^\/api\/v1\/[\w./~%-]+$/.test(url) && !url.includes("..") ? url : undefined
}

export function entityLabel(entity: GraphEntity | undefined, locale: "en" | "ar") {
  return entity?.labelVariants?.[locale] ?? entity?.label
}

/* ---------- run (transport metadata, not a domain family) ---------- */

export const runStatusSchema = z.looseObject({
  runId: z.string(),
  status: z.string(), // queued | running | paused | complete | failed | cancelled
  progress: z
    .looseObject({ completed: z.number(), total: z.number().optional() })
    .optional(),
  error: z
    .looseObject({ code: z.string().optional(), message: z.string() })
    .nullable()
    .optional(),
})
export type RunStatus = z.infer<typeof runStatusSchema>

export const TERMINAL_RUN_STATES = new Set(["complete", "failed", "cancelled"])

/* ---------- snapshots ---------- */

export const snapshotSchema = z.looseObject({
  workspaceId: z.string().optional(),
  revision: z.number().optional(),
  entities: z.array(entitySchema).default([]),
  relationships: z.array(relationshipSchema).default([]),
  tickets: z.array(ticketSchema).default([]),
  run: runStatusSchema.nullable().optional(),
})
export type Snapshot = z.infer<typeof snapshotSchema>

/* ---------- SSE ---------- */

export const SSE_EVENTS = {
  entity: "graph.entity.upsert",
  relationship: "graph.relationship.upsert",
  ticket: "ticket.upsert",
  run: "run.status",
} as const

export const entityUpsertSchema = z.looseObject({
  revision: z.number(),
  data: entitySchema,
})
export const relationshipUpsertSchema = z.looseObject({
  revision: z.number(),
  data: relationshipSchema,
})
export const ticketUpsertSchema = z.looseObject({
  revision: z.number(),
  data: ticketSchema,
})

/* ---------- errors ---------- */

export const errorEnvelopeSchema = z.object({
  error: z.looseObject({
    code: z.string(),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    requestId: z.string().optional(),
    currentRevision: z.number().optional(),
  }),
})
