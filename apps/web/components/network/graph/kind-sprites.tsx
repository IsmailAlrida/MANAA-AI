import { renderToStaticMarkup } from "react-dom/server"
import type { Icon } from "@tabler/icons-react"

import { EPIC_ICON, kindStyle } from "./kind-icon"

/**
 * The canvas can't draw React components, so each Tabler glyph is rendered once
 * to an SVG image (white stroke, drawn on top of the coloured shape) and cached.
 */
const cache = new Map<string, HTMLImageElement>()

function sprite(key: string, Icon: Icon, onLoad: () => void, color: string) {
  const id = `${key}|${color}`
  const hit = cache.get(id)
  if (hit) return hit
  const svg = renderToStaticMarkup(<Icon size={64} stroke={2.2} color={color} />)
  const img = new Image()
  img.onload = onLoad
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  cache.set(id, img)
  return img
}

export const kindSprite = (kind: string, onLoad: () => void) =>
  sprite(`kind:${kindStyle(kind).Icon.displayName ?? kind}`, kindStyle(kind).Icon, onLoad, "#ffffff")

/** The investigation-epic glyph, tinted to the community colour. */
export const epicSprite = (color: string, onLoad: () => void) => sprite("epic", EPIC_ICON, onLoad, color)
