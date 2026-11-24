"use client"

import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Separator } from "@workspace/ui/components/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { EvidenceRefBadge } from "../evidence"

/** `[EV-…](…)` links and backend asset links become citation chips. */
const EVIDENCE_ID = /^EV-[A-Z0-9-]+$/
const ASSET_PATH = /\/api\/v1\/assets\/([^/?#]+)/

function textOf(children: React.ReactNode): string {
  return typeof children === "string" ? children : Array.isArray(children) ? children.map(textOf).join("") : ""
}

/**
 * react-markdown never renders raw HTML (no rehype-raw), so report text is
 * data, not markup. Element mapping reuses shadcn primitives; the only
 * Tailwind is heading scale, which preflight otherwise flattens.
 */
const components: Components = {
  h1: ({ children }) => <h2 className="text-lg font-medium">{children}</h2>,
  h2: ({ children }) => <h3 className="text-base font-medium">{children}</h3>,
  h3: ({ children }) => <h4 className="font-medium">{children}</h4>,
  ul: ({ children }) => <ul className="list-disc ps-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ps-5">{children}</ol>,
  hr: () => <Separator />,
  code: ({ children }) => <code dir="ltr">{children}</code>,
  a: ({ href, children }) => {
    const text = textOf(children)
    const assetId = href?.match(ASSET_PATH)?.[1]
    if (EVIDENCE_ID.test(text)) return <EvidenceRefBadge id={text} />
    if (assetId && EVIDENCE_ID.test(assetId)) return <EvidenceRefBadge id={assetId} />
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline">
        {children}
      </a>
    )
  },
  table: ({ children }) => <Table>{children}</Table>,
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableHead>{children}</TableHead>,
  td: ({ children }) => <TableCell>{children}</TableCell>,
  img: ({ alt }) => <span>[{alt}]</span>, // never hot-load report-supplied images
}

export function ReportMarkdown({ text }: { text: string }) {
  return (
    <div dir="auto" className="flex flex-col gap-3">
      <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {text}
      </Markdown>
    </div>
  )
}
