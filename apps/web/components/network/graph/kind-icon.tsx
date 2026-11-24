"use client"

import {
  IconAd2,
  IconAt,
  IconBuilding,
  IconBuildingBank,
  IconCircleDashed,
  IconLink,
  IconMessage,
  IconReceipt2,
  IconServer,
  IconShoppingBag,
  IconTopologyStar3,
  IconUser,
  IconWorld,
  type Icon,
} from "@tabler/icons-react"

import { useLocale } from "@/lib/i18n"

export type KindGroup = "org" | "identity" | "web" | "content" | "infra" | "money"
export type KindShape = "circle" | "square" | "diamond" | "hexagon"

export interface KindStyle {
  group: KindGroup
  shape: KindShape
  Icon: Icon
}

/**
 * Every entity kind is told apart three ways, never by colour alone:
 * a SHAPE (person = circle, company/bank = rounded square, server = hexagon,
 * transaction = diamond), an ICON glyph, and a colour family.
 * Unknown kinds fall back to a neutral dashed circle.
 */
const STYLES: Record<string, KindStyle> = {
  company: { group: "org", shape: "square", Icon: IconBuilding },
  person: { group: "identity", shape: "circle", Icon: IconUser },
  social_account: { group: "identity", shape: "circle", Icon: IconAt },
  url: { group: "web", shape: "circle", Icon: IconWorld },
  website: { group: "web", shape: "circle", Icon: IconWorld },
  link: { group: "web", shape: "circle", Icon: IconLink },
  ad: { group: "content", shape: "circle", Icon: IconAd2 },
  social_post: { group: "content", shape: "circle", Icon: IconMessage },
  marketplace_listing: { group: "content", shape: "circle", Icon: IconShoppingBag },
  server: { group: "infra", shape: "hexagon", Icon: IconServer },
  bank_account: { group: "money", shape: "square", Icon: IconBuildingBank },
  transaction: { group: "money", shape: "diamond", Icon: IconReceipt2 },
}
const FALLBACK: KindStyle = { group: "infra", shape: "circle", Icon: IconCircleDashed }

export const kindStyle = (kind: string): KindStyle => STYLES[kind] ?? FALLBACK
export const kindGroup = (kind: string): KindGroup => kindStyle(kind).group
export const EPIC_ICON = IconTopologyStar3

/** Kinds shown in the legend, in reading order. */
export const LEGEND_KINDS = ["company", "person", "server", "transaction", "url", "marketplace_listing", "bank_account", "social_account"] as const

const CLIP: Record<KindShape, string | undefined> = {
  circle: undefined,
  square: undefined,
  diamond: undefined,
  hexagon: "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)",
}

/** The kind's shape + glyph as a small chip, for legend, tables, inspector and the hover card. */
export function KindChip({ kind, size = 20 }: { kind: string; size?: number }) {
  const { shape, group, Icon } = kindStyle(kind)
  const inner = shape === "diamond" ? size * 0.78 : size
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: inner,
          height: inner,
          background: `var(--kind-${group})`,
          color: "var(--card)",
          borderRadius: shape === "circle" ? "9999px" : shape === "square" ? size * 0.28 : shape === "diamond" ? size * 0.12 : 0,
          transform: shape === "diamond" ? "rotate(45deg)" : undefined,
          clipPath: CLIP[shape],
        }}
      >
        <span style={{ display: "flex", transform: shape === "diamond" ? "rotate(-45deg)" : undefined }}>
          <Icon size={Math.round(size * 0.6)} stroke={2.2} />
        </span>
      </span>
    </span>
  )
}

/** Translated kind name; unknown kinds show their raw id. */
export function useKindName() {
  const { t } = useLocale()
  return (kind: string) => t.network.kindNames[kind] ?? kind.replaceAll("_", " ")
}

/** Chip + name, e.g. [building] Company. */
export function KindLabel({ kind, size = 18 }: { kind: string; size?: number }) {
  const name = useKindName()
  return (
    <span className="inline-flex items-center gap-1.5">
      <KindChip kind={kind} size={size} />
      <span>{name(kind)}</span>
    </span>
  )
}
