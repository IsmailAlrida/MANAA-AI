import { execFile as execFileCb } from "node:child_process"
import { createHash } from "node:crypto"
import { promisify } from "node:util"
import { DomainError } from "./domain/types.ts"
import type { ArtifactData } from "./domain/types.ts"
import type { PlanStep, RevealPlan } from "./fixtures/plan.ts"

const execFile = promisify(execFileCb)
const CASE_REQUEST =
  /^(?:controlled (?:uae )?brand review|review the controlled uae brand case|investigate the reported payment link https:\/\/pay\.example\.test\/notice)$/i

type Json = Record<string, any>
type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

export interface EngineAdapterOptions {
  guestExecPath: string
  resultsUrl: string
  runGuest?: (layer: "osint" | "police", runId: string) => Promise<void>
  fetch?: FetchLike
  sources?: Map<string, string>
}

function safeRunId(runId: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(runId)) {
    throw new Error("Invalid generated run ID")
  }
  return runId
}

function asObject(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {}
}

function extractControlledPayload(result: Json): Json {
  if (
    Array.isArray(result.candidate_dispositions) &&
    Array.isArray(result.cited_source_observations)
  )
    return result
  for (const artifact of Array.isArray(result.artifacts)
    ? result.artifacts
    : []) {
    const payload = asObject(artifact?.payload)
    if (
      Array.isArray(payload.candidate_dispositions) &&
      Array.isArray(payload.cited_source_observations)
    )
      return payload
  }
  throw new Error(
    "Police result does not contain a controlled-case result payload"
  )
}

function safeId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80)
}

function makePlan(
  runId: string,
  wrapper: Json,
  sources: Map<string, string>
): RevealPlan {
  const result = extractControlledPayload(asObject(wrapper.result))
  const observations = result.cited_source_observations as Json[]
  const dispositions = result.candidate_dispositions as Json[]
  if (!observations.length || !dispositions.length)
    throw new Error("Controlled result has no cited evidence or candidates")
  const names = asObject(result.source_names)
  const sourceNameEn = typeof names.en === "string" ? names.en : ""
  const sourceNameAr = typeof names.ar === "string" ? names.ar : ""
  if (!sourceNameEn || !sourceNameAr)
    throw new Error("Controlled result is missing its bilingual source names")

  const artifactDetails = (
    Array.isArray(result.artifacts) ? result.artifacts : []
  ) as Json[]
  for (const observation of observations) {
    if (
      typeof observation.evidence_id !== "string" ||
      typeof observation.source_ref !== "string" ||
      !observation.source_ref ||
      typeof observation.claim !== "string" ||
      !observation.claim.trim() ||
      typeof observation.observed_at !== "string" ||
      observation.source_name !== sourceNameEn ||
      observation.source_name_ar !== sourceNameAr
    ) {
      throw new Error(
        "Controlled evidence must retain its observed claim, citation, timestamp, and exact bilingual source names"
      )
    }
    const preserved = artifactDetails.some((artifact) => {
      const payload = asObject(artifact?.payload)
      const originalNames = asObject(payload.source_names)
      return (
        originalNames.en === sourceNameEn &&
        originalNames.ar === sourceNameAr &&
        Array.isArray(payload.cited_source_observations) &&
        payload.cited_source_observations.some(
          (item: Json) =>
            item?.evidence_id === observation.evidence_id &&
            item?.source_ref === observation.source_ref &&
            item?.source_name === sourceNameEn &&
            item?.source_name_ar === sourceNameAr
        )
      )
    })
    if (!preserved) {
      throw new Error(
        `Result citation ${observation.source_ref} is not present in the preserved source artifact`
      )
    }
  }
  for (const disposition of dispositions) {
    if (
      typeof disposition.host !== "string" ||
      typeof disposition.disposition !== "string" ||
      typeof disposition.status !== "string" ||
      typeof disposition.reason !== "string" ||
      !disposition.reason.trim()
    ) {
      throw new Error("Controlled candidate disposition is incomplete")
    }
  }
  const findingSummary = result.finding_summary
  if (typeof findingSummary !== "string" || !findingSummary.trim())
    throw new Error("Controlled result is missing its finding summary")

  const evidenceById = new Map<string, Json>()
  for (const observation of observations) {
    if (
      typeof observation.evidence_id !== "string" ||
      typeof observation.source_ref !== "string"
    )
      continue
    evidenceById.set(observation.evidence_id, observation)
  }
  if (
    dispositions.some(
      (d) =>
        typeof d.evidence_id !== "string" || !evidenceById.has(d.evidence_id)
    )
  ) {
    throw new Error(
      "Controlled result contains a disposition without matching cited evidence"
    )
  }

  const evidenceIds = [...evidenceById.keys()]
  const entities: ArtifactData[] = []
  const idsByHost = new Map<string, string>()
  for (const disposition of dispositions) {
    const host = String(disposition.host)
    const evidenceId = String(disposition.evidence_id)
    const hostHash = createHash("sha256")
      .update(host)
      .digest("hex")
      .slice(0, 10)
    const entityId = `ENT-CTRL-URL-${safeId(host)}-${hostHash}`
    idsByHost.set(host, entityId)
    entities.push({
      id: entityId,
      kind: "url",
      url: `https://${host}/`,
      host,
      label: host,
      labelVariants: { en: host, ar: host },
      nameVariants: [
        {
          value: host,
          languageTag: "und",
          evidenceIds: [evidenceId],
          sourceReference: String(evidenceById.get(evidenceId)?.source_ref),
        },
      ],
      provenance: [{ evidenceId }],
      support:
        disposition.disposition === "protected" ? "observed" : "possible",
      uncertainty: String(disposition.reason ?? ""),
      attributes: {
        disposition: disposition.disposition,
        reviewStatus: disposition.status,
        controlledFixture: true,
      },
    })
  }
  const authorityId = "ENT-CTRL-ORG-OFFICIAL"
  const primaryEvidenceId = evidenceIds[0]!
  entities.push({
    id: authorityId,
    kind: "organization",
    label: sourceNameEn,
    labelVariants: { en: sourceNameEn, ar: sourceNameAr },
    nameVariants: [
      {
        value: sourceNameEn,
        languageTag: "en",
        evidenceIds,
        sourceReference: String(
          evidenceById.get(primaryEvidenceId)?.source_ref
        ),
      },
      {
        value: sourceNameAr,
        languageTag: "ar",
        evidenceIds,
        sourceReference: String(
          evidenceById.get(primaryEvidenceId)?.source_ref
        ),
      },
    ],
    provenance: evidenceIds.map((evidenceId) => ({ evidenceId })),
    support: "observed",
    uncertainty:
      "The controlled record is synthetic and does not establish real-world ownership or attribution.",
    attributes: { controlledFixture: true },
  })

  const relationships: ArtifactData[] = []
  const nearMatch = dispositions.find((d) => d.disposition === "near_match")
  if (nearMatch) {
    const evidenceId = String(nearMatch.evidence_id)
    const en =
      "The saved controlled case describes a near-match payment claim; it does not establish ownership or intent."
    const ar =
      "تصف الحالة المحفوظة المطابقة تقريباً مطالبة دفع؛ ولا تثبت الملكية أو القصد."
    relationships.push({
      id: `REL-CTRL-NEAR-${safeId(String(nearMatch.host))}`,
      fromEntityId: idsByHost.get(String(nearMatch.host)),
      toEntityId: authorityId,
      kind: "near_match_claim",
      evidenceIds: [evidenceId],
      observedAt: String(
        evidenceById.get(evidenceId)?.observed_at ?? wrapper.completed_at
      ),
      support: "possible",
      strength: "weak",
      rationale: en,
      rationaleVariants: { en, ar },
    })
  }

  for (const evidenceId of evidenceIds) {
    const observation = evidenceById.get(evidenceId)!
    const original =
      artifactDetails.find((artifact) => {
        const payload = asObject(artifact?.payload)
        return (
          Array.isArray(payload.cited_source_observations) &&
          payload.cited_source_observations.some(
            (item: Json) =>
              item?.evidence_id === evidenceId &&
              item?.source_ref === observation.source_ref
          )
        )
      }) ?? null
    if (!original)
      throw new Error(`Original evidence artifact for ${evidenceId} is missing`)
    const sourceContent = [
      `# Original controlled evidence ${evidenceId}`,
      "",
      `Source reference: ${String(observation.source_ref)}`,
      `Captured at: ${String(observation.observed_at ?? wrapper.completed_at)}`,
      "",
      "## Original observation",
      "",
      "```json",
      JSON.stringify({ observation, artifact: original }, null, 2),
      "```",
    ].join("\n")
    sources.set(evidenceId, sourceContent)
  }

  const id = `TKT-CTRL-${safeId(runId)}`
  const evidenceBlocks = evidenceIds.map((evidenceId, i) => {
    const observation = evidenceById.get(evidenceId)!
    const titleEn = `Controlled source observation ${i + 1}`
    const titleAr = `ملاحظة المصدر المطابقة ${i + 1}`
    const summaryEn = `${observation.claim} [${evidenceId}]`
    const summaryAr =
      evidenceId === "ev-protected"
        ? `النطاق يطابق مرجعاً محمياً مدرجاً في السجل. [${evidenceId}]`
        : evidenceId === "ev-near"
          ? `تتضمن المطالبة المحفوظة نطاقاً مشابهاً وطلب دفع اصطناعياً. [${evidenceId}]`
          : `لا تتوفر لقطة محفوظة أو مصدر مستقل للفحص. [${evidenceId}]`
    return {
      id: `BLK-${evidenceId}`,
      type: "evidence",
      evidenceId,
      title: titleEn,
      summary: summaryEn,
      language: "en",
      sourceReference: String(observation.source_ref),
      capturedAt: String(observation.observed_at ?? wrapper.completed_at),
      collectionMethod: "controlled_case_review",
      support: "observed",
      asset: { url: `/api/v1/assets/${evidenceId}`, mimeType: "text/markdown" },
    }
  })
  const evidenceByBlockId: Json = {}
  evidenceIds.forEach((evidenceId, i) => {
    const observation = evidenceById.get(evidenceId)!
    const summaryAr =
      evidenceId === "ev-protected"
        ? `النطاق يطابق مرجعاً محمياً مدرجاً في السجل. [${evidenceId}]`
        : evidenceId === "ev-near"
          ? `تتضمن المطالبة المحفوظة نطاقاً مشابهاً وطلب دفع اصطناعياً. [${evidenceId}]`
          : `لا تتوفر لقطة محفوظة أو مصدر مستقل للفحص. [${evidenceId}]`
    evidenceByBlockId[`BLK-${evidenceId}`] = {
      title: `ملاحظة المصدر المطابقة ${i + 1}`,
      summary: summaryAr,
    }
  })
  const referenceLinesEn = evidenceIds
    .map((e) => `- [${e}](/api/v1/assets/${e}) — Controlled source capture`)
    .join("\n")
  const referenceLinesAr = evidenceIds
    .map((e) => `- [${e}](/api/v1/assets/${e}) — سجل المصدر المطابق`)
    .join("\n")
  const review = asObject(wrapper.result?.model_review)
  let modelAssessment = ""
  if (Object.keys(review).length > 0) {
    const uncertainties = review.uncertainties
    if (
      review.status !== "completed" ||
      review.review_only !== true ||
      typeof review.model !== "string" ||
      typeof review.assessment !== "string" ||
      !review.assessment.trim() ||
      review.assessment.length > 1200 ||
      !Array.isArray(uncertainties) ||
      uncertainties.length > 5 ||
      uncertainties.some(
        (item: unknown) =>
          typeof item !== "string" || !item.trim() || item.length > 240
      )
    ) {
      throw new Error(
        "Controlled model review does not match its validated schema"
      )
    }
    modelAssessment = review.assessment.trim()
  }
  const reportEn = `# Controlled UAE brand review\n\n${findingSummary}\n\n**Source name (verbatim):** ${sourceNameEn}\n\n## Candidate review\n\n${dispositions.map((d) => `- ${d.host}: ${d.disposition} (${d.status}). ${d.reason}`).join("\n")}\n\n## Evidence citations\n\n${referenceLinesEn}`
  const dispositionAr = (d: Json) => {
    const reason =
      d.disposition === "protected"
        ? "يطابق مرجعاً محمياً، لذا استُبعد من تقييم المرشحين."
        : d.disposition === "near_match"
          ? "تصف الحالة المحفوظة مطالبة دفع ذات نطاق مشابه؛ ولا تثبت النسبة أو القصد."
          : "لا تتوفر لقطة قابلة للفحص أو مصدر مستقل."
    const label =
      d.disposition === "protected"
        ? "محمي"
        : d.disposition === "near_match"
          ? "تطابق قريب"
          : "غير محسوم"
    const status =
      d.status === "excluded"
        ? "مستبعد"
        : d.status === "review_required"
          ? "يتطلب المراجعة"
          : "أدلة غير كافية"
    return `- ${d.host}: ${label} (${status}). ${reason}`
  }
  const reportAr = `# مراجعة العلامة التجارية المطابقة في الإمارات\n\nتم جمع نتيجة الحالة المطابقة ومراجعتها. جميع البيانات اصطناعية ولا تمثل سجلاً حقيقياً.\n\n**الاسم كما ورد في المصدر حرفياً:** ${sourceNameAr}\n\n## مراجعة النطاقات\n\n${dispositions.map(dispositionAr).join("\n")}\n\n## مراجع الأدلة\n\n${referenceLinesAr}`
  const titleEn = "Controlled UAE brand review"
  const titleAr = "مراجعة العلامة التجارية المطابقة في الإمارات"
  const summaryEn = findingSummary
  const summaryAr = "مراجعة مطابقة محكومة؛ ولا تزال المراجعة البشرية مطلوبة."
  const ticket: ArtifactData = {
    id,
    title: titleEn,
    summary: summaryEn,
    status: "open",
    closingDate: null,
    reportMarkdown: reportEn,
    blocks: [
      { id: `BLK-${id}-REPORT`, type: "markdown", text: reportEn },
      ...evidenceBlocks,
    ],
    evidenceIds,
    entityIds: entities.map((e) => e.id),
    relationshipIds: relationships.map((r) => r.id),
    ...(modelAssessment ? { modelReview: review } : {}),
    contentVariants: {
      en: {
        title: titleEn,
        summary: summaryEn,
        reportMarkdown: reportEn,
        blockTextById: {
          ...evidenceByBlockId,
          [`BLK-${id}-REPORT`]: { text: reportEn },
        },
      },
      ar: {
        title: titleAr,
        summary: summaryAr,
        reportMarkdown: reportAr,
        blockTextById: {
          ...evidenceByBlockId,
          [`BLK-${id}-REPORT`]: { text: reportAr },
        },
      },
    },
  }
  const step: PlanStep = {
    evidenceId: primaryEvidenceId,
    entities,
    relationships,
    tickets: [{ data: ticket, complete: true }],
  }
  return { workspaceId: "workspace-controlled-case", steps: [step] }
}

export function createEngineAdapter(options: EngineAdapterOptions) {
  const sources = options.sources ?? new Map<string, string>()
  const runGuest =
    options.runGuest ??
    (async (layer, runId) => {
      await execFile(options.guestExecPath, [layer, "run", runId], {
        timeout: 180_000,
        maxBuffer: 2 * 1024 * 1024,
      })
    })
  const fetchImpl = options.fetch ?? fetch
  return {
    name: "controlled-engine",
    sources,
    async prepareRun({
      runId,
      requestText,
    }: {
      runId: string
      requestText: string | null
    }) {
      safeRunId(runId)
      if (requestText && !CASE_REQUEST.test(requestText.trim())) {
        throw new DomainError(
          422,
          "validation_error",
          "Engine mode currently accepts only the controlled UAE brand review request.",
          {
            fieldErrors: {
              requestText: "Use the controlled UAE brand review request.",
            },
          }
        )
      }
      // Both commands are idempotent on RUN_ID. Restart replay therefore
      // recovers the same host result without creating a second finding.
      await runGuest("osint", runId)
      await runGuest("police", runId)
      const findingId = `finding-${runId}`
      const response = await fetchImpl(
        `${options.resultsUrl.replace(/\/$/, "")}/${encodeURIComponent(findingId)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        }
      )
      if (!response.ok)
        throw new Error(
          `Controlled result fetch failed with HTTP ${response.status}`
        )
      const wrapper = asObject(await response.json())
      if (wrapper.finding_id !== findingId || wrapper.status !== "completed") {
        throw new Error(
          "Host returned a result for a different or incomplete finding"
        )
      }
      return makePlan(runId, wrapper, sources)
    },
  }
}
