"use client"

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui/components/item"

import { entityLabel, type GraphEntity } from "@/lib/api/types"
import { SupportBadge } from "../../evidence"
import { useLocale } from "@/lib/i18n"
import { NODE_H, NODE_W } from "./layout"
import { KindIcon, kindGroup } from "./kind-icon"

export type EntityNodeType = Node<{ entity: GraphEntity }, "entity">

export function EntityNode({ data, selected }: NodeProps<EntityNodeType>) {
  const e = data.entity
  const { locale } = useLocale()
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Item
        size="sm"
        variant={selected ? "muted" : "outline"}
        aria-current={selected || undefined}
        style={{
          width: NODE_W,
          minHeight: NODE_H,
          background: "var(--card)",
          borderInlineStart: `3px solid var(--kind-${kindGroup(e.kind)})`,
        }}
      >
        <ItemMedia variant="icon">
          <KindIcon kind={e.kind} style={{ color: `var(--kind-${kindGroup(e.kind)})` }} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle dir="auto">{entityLabel(e, locale) ?? e.id}</ItemTitle>
          <ItemDescription>
            {e.kind} <SupportBadge support={e.support} />
          </ItemDescription>
        </ItemContent>
      </Item>
      <Handle type="source" position={Position.Right} />
    </>
  )
}
