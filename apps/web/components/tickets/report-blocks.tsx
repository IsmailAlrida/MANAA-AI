"use client"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"

import type { ReportBlock } from "@/lib/api/types"
import { useLocale } from "@/lib/i18n"
import { EvidenceItem } from "../evidence"
import { ReportMarkdown } from "./report-markdown"

/**
 * Typed block renderer. Markdown goes through react-markdown (no raw HTML).
 * Unknown block kinds render as an inspectable generic record.
 */
export function ReportBlocks({ blocks }: { blocks: ReportBlock[] }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b) => (
        <Block key={b.id} block={b} />
      ))}
    </div>
  )
}

function Block({ block }: { block: ReportBlock }) {
  const { t } = useLocale()
  switch (block.type) {
    case "markdown":
      return <ReportMarkdown text={block.text ?? ""} />
    case "evidence":
      return <EvidenceItem block={block} />
    default:
      return (
        <Alert>
          <AlertTitle>
            {t.tickets.unknownBlock}: <code>{block.type}</code>
          </AlertTitle>
          <AlertDescription>
            <code>{block.id}</code>
          </AlertDescription>
        </Alert>
      )
  }
}
