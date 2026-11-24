"use client"

import * as React from "react"
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d"
import { IconFocus2, IconMinus, IconPlus } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { forceCollide, forceX, forceY } from "d3-force"
import { useTheme } from "next-themes"

import { entityLabel, type GraphEntity, type GraphRelationship } from "@/lib/api/types"
import { useLocale } from "@/lib/i18n"
import { useWorkspace } from "@/lib/workspace/store"
import { Hint } from "../../hint"
import { INFERRED_DASH, NEUTRAL_EDGE, STRENGTH_STYLE } from "./edge-style"
import { bubblePoints, buildDotGraph, dotRadius } from "./graph-model"
import { EntityHoverCard } from "./hover-card"
import { kindStyle, type KindShape } from "./kind-icon"
import { epicSprite, kindSprite } from "./kind-sprites"

interface GNode {
  id: string
  entity: GraphEntity
  degree: number
  community: number
  r: number
}
interface GLink {
  id: string
  relationship: GraphRelationship
}
type N = NodeObject<GNode>
type L = LinkObject<GNode, GLink>
type FG = ForceGraphMethods<N, L>

const DISTANCE = { strong: 120, medium: 165, weak: 230 } as const
const BUBBLE_PAD = 30
const FIT_PAD = 64
const LABEL_ROOM = 90
const LEGEND_ROOM = 204
const HOVER_DELAY = 450
const CARD = { w: 288, h: 224 }
const clip = (s: string, n = 24) => (s.length > n ? s.slice(0, n - 1) + "…" : s)
const isRtlText = (s: string) => /[֐-ࣿ]/.test(s)

/** Canvas can't read CSS variables directly: resolve the palette tokens once per theme. */
function readPalette(el: HTMLElement) {
  const cs = getComputedStyle(el)
  const v = (name: string) => cs.getPropertyValue(`--${name}`).trim()
  return {
    card: v("card"),
    fg: v("foreground"),
    canvas: v("canvas"),
    grid: v("grid-dot"),
    primary: v("primary"),
    muted: v("muted-foreground"),
    kind: Object.fromEntries(["org", "identity", "web", "content", "infra", "money"].map((g) => [g, v(`kind-${g}`)])) as Record<string, string>,
    community: [1, 2, 3, 4, 5, 6].map((i) => v(`community-${i}`)),
    strength: { strong: v("strength-strong"), medium: v("strength-medium"), weak: v("strength-weak") },
  }
}
type Palette = ReturnType<typeof readPalette>

/**
 * Two jobs: pull each node toward its community's centroid so groups read as
 * groups, and push whole communities apart when their bubbles would overlap.
 */
function communityForce(strength: number) {
  let nodes: N[] = []
  const force = (alpha: number) => {
    const groups = new Map<number, { x: number; y: number; n: number; r: number; members: N[] }>()
    for (const n of nodes) {
      const g = groups.get(n.community) ?? { x: 0, y: 0, n: 0, r: 0, members: [] }
      g.x += n.x ?? 0
      g.y += n.y ?? 0
      g.n++
      g.members.push(n)
      groups.set(n.community, g)
    }
    for (const g of groups.values()) {
      g.x /= g.n
      g.y /= g.n
      g.r = Math.max(...g.members.map((m) => Math.hypot((m.x ?? 0) - g.x, (m.y ?? 0) - g.y) + m.r)) + BUBBLE_PAD
    }
    for (const g of groups.values()) {
      if (g.n < 2) continue
      for (const n of g.members) {
        n.vx = (n.vx ?? 0) + (g.x - (n.x ?? 0)) * strength * alpha
        n.vy = (n.vy ?? 0) + (g.y - (n.y ?? 0)) * strength * alpha
      }
    }
    const gs = [...groups.values()].filter((g) => g.n >= 2)
    for (let i = 0; i < gs.length; i++)
      for (let j = i + 1; j < gs.length; j++) {
        const a = gs[i]!, b = gs[j]!
        const dx = b.x - a.x || 0.01, dy = b.y - a.y || 0.01
        const d = Math.hypot(dx, dy), overlap = a.r + b.r + 20 - d
        if (overlap <= 0) continue
        const f = (overlap / d) * 0.5 * Math.min(1, alpha * 4)
        for (const n of a.members) (n.vx = (n.vx ?? 0) - dx * f), (n.vy = (n.vy ?? 0) - dy * f)
        for (const n of b.members) (n.vx = (n.vx ?? 0) + dx * f), (n.vy = (n.vy ?? 0) + dy * f)
      }
  }
  force.initialize = (n: N[]) => void (nodes = n)
  return force
}

function shapePath(ctx: CanvasRenderingContext2D, shape: KindShape, x: number, y: number, r: number) {
  ctx.beginPath()
  if (shape === "circle") ctx.arc(x, y, r, 0, Math.PI * 2)
  else if (shape === "square") ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.32)
  else if (shape === "diamond") {
    const d = r * 1.2
    ctx.moveTo(x, y - d), ctx.lineTo(x + d, y), ctx.lineTo(x, y + d), ctx.lineTo(x - d, y)
  } else
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6
      ctx[i ? "lineTo" : "moveTo"](x + Math.cos(a) * r * 1.08, y + Math.sin(a) * r * 1.08)
    }
  ctx.closePath()
}

/**
 * Relationship graph on react-force-graph-2d: the library owns the simulation,
 * pan/zoom, hit-testing and hover; this file only adds what it doesn't have —
 * shapes + glyphs per entity kind, community bubbles, the dotted grid, and the
 * hover dossier. Communities come from the relationships (graph-model).
 * The camera frames the graph once and never moves on its own afterwards.
 */
export function NetworkGraph({
  entities,
  relationships,
  selectedId,
  onSelect,
  overlay,
  legend,
}: {
  entities: GraphEntity[]
  relationships: GraphRelationship[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Status content (loading/empty) floated over the canvas; the canvas never unmounts. */
  overlay?: React.ReactNode
  /** Hideable key, pinned to the start side of the canvas. */
  legend?: React.ReactNode
}) {
  const { locale, dir, t } = useLocale()
  const { legendOpen } = useWorkspace()
  const { resolvedTheme } = useTheme()
  const graph = React.useMemo(() => buildDotGraph(entities, relationships), [entities, relationships])

  const wrapRef = React.useRef<HTMLDivElement>(null)
  const fgRef = React.useRef<FG | undefined>(undefined)
  const nodesRef = React.useRef(new Map<string, N>())
  const fitted = React.useRef(false)
  const pointer = React.useRef({ x: 0, y: 0 })
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  // Left button moves nodes; the right or middle button pans (the library's own left-drag pan is off).
  const panning = React.useRef<{ x: number; y: number; cx: number; cy: number; k: number } | null>(null)
  const [panActive, setPanActive] = React.useState(false)
  const [size, setSize] = React.useState({ w: 0, h: 0 })
  const [hoverId, setHoverId] = React.useState<string | null>(null)
  const [card, setCard] = React.useState<{ id: string; x: number; y: number } | null>(null)
  const [, setSprites] = React.useState(0)
  const [reduced, setReduced] = React.useState(false)
  const palette = React.useMemo<Palette | null>(
    () => (wrapRef.current ? readPalette(wrapRef.current) : null),
    // re-read when the theme flips; size.w gates the first read until mounted
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedTheme, size.w > 0]
  )
  const onSprite = React.useCallback(() => setSprites((n) => n + 1), [])

  React.useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ---- graph data: node objects persist, so the library keeps their positions ---- */
  const data = React.useMemo(() => {
    const next = new Map<string, N>()
    for (const n of graph.nodes) {
      const old = nodesRef.current.get(n.id)
      next.set(n.id, Object.assign(old ?? ({ id: n.id } as N), { entity: n.entity, degree: n.degree, community: n.community, r: dotRadius(n.degree) }))
    }
    nodesRef.current = next
    return {
      nodes: [...next.values()],
      links: graph.links.map((l) => ({ id: l.id, source: l.source, target: l.target, relationship: l.relationship })) as unknown as L[],
    }
  }, [graph])

  /* ---- forces: the graph only mounts once size and palette are known, so configure then ---- */
  const ready = size.w > 0 && !!palette
  React.useEffect(() => {
    const fg = fgRef.current
    if (!fg || !ready) return
    ;(fg.d3Force("charge") as unknown as { strength: (n: number) => { distanceMax: (n: number) => void } })?.strength(-720).distanceMax(900)
    const link = fg.d3Force("link") as unknown as {
      distance: (f: (l: L) => number) => { strength: (f: (l: L) => number) => void }
    }
    link?.distance((l) => DISTANCE[l.relationship?.strength ?? "weak"]).strength((l) => (l.relationship?.strength === "weak" ? 0.25 : 0.6))
    fg.d3Force("center", null)
    fg.d3Force("x", forceX(0).strength(0.035) as never)
    fg.d3Force("y", forceY(0).strength(0.035) as never)
    fg.d3Force("collide", forceCollide<N>((n) => (n as N).r + 30) as never)
    fg.d3Force("community", communityForce(0.4) as never)
    fg.d3ReheatSimulation()
  }, [ready])

  /* ---- camera: frame once, leaving room for the legend and for labels ---- */
  const fit = React.useCallback(
    (ms = 0) => {
      const fg = fgRef.current
      if (!fg || size.w === 0 || data.nodes.length === 0) return
      const bb = fg.getGraphBbox()
      const pad = BUBBLE_PAD + FIT_PAD
      const w = bb.x[1] - bb.x[0] + pad * 2 + LABEL_ROOM * 1.5
      const h = bb.y[1] - bb.y[0] + pad * 2
      const room = legend && legendOpen ? LEGEND_ROOM : 0
      const k = Math.min(1.5, (size.w - room) / w, size.h / h)
      const shift = (locale === "ar" ? -room : room) / 2 // free area's centre vs the canvas centre, in px
      fg.zoom(k, ms)
      fg.centerAt((bb.x[0] + bb.x[1]) / 2 - shift / k, (bb.y[0] + bb.y[1]) / 2, ms)
    },
    [size, data.nodes.length, legend, legendOpen, locale]
  )

  const zoomBy = (f: number) => fgRef.current && fgRef.current.zoom(fgRef.current.zoom() * f, 200)

  /* ---- hover dossier: shown after a short dwell, hidden on any movement away ---- */
  const hoverNode = (n: N | null) => {
    clearTimeout(timer.current)
    setHoverId(n?.id ?? null)
    setCard(null)
    if (n) timer.current = setTimeout(() => setCard({ id: n.id, ...pointer.current }), HOVER_DELAY)
  }
  React.useEffect(() => () => clearTimeout(timer.current), [])

  const focus = hoverId ?? selectedId
  const near = React.useMemo(() => {
    const s = new Set<string>()
    if (focus) {
      s.add(focus)
      for (const l of graph.links) {
        if (l.source === focus) s.add(l.target)
        if (l.target === focus) s.add(l.source)
      }
    }
    return s
  }, [focus, graph.links])

  const label = (e: GraphEntity) => entityLabel(e, locale) ?? e.id
  const hubOf = React.useMemo(() => {
    const m = new Map<number, { entity: GraphEntity; degree: number }>()
    for (const n of graph.nodes) if (!m.get(n.community) || n.degree > m.get(n.community)!.degree) m.set(n.community, n)
    return m
  }, [graph.nodes])

  /* ---- drawing ---- */
  const drawBackdrop = (ctx: CanvasRenderingContext2D, scale: number) => {
    const fg = fgRef.current
    if (!fg || !palette) return
    // The library lays nodes out lazily; frame only once every node has a real position.
    if (!fitted.current && data.nodes.length > 0 && size.w > 0 && data.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))) {
      fitted.current = true
      fit(0)
    }
    // dotted grid, in graph space so it pans and zooms with the camera
    const a = fg.screen2GraphCoords(0, 0), b = fg.screen2GraphCoords(size.w, size.h)
    let step = 24
    while (step * scale < 12) step *= 2
    ctx.fillStyle = palette.grid
    const r = 0.9 / scale
    for (let x = Math.floor(a.x / step) * step; x < b.x; x += step)
      for (let y = Math.floor(a.y / step) * step; y < b.y; y += step) ctx.fillRect(x - r, y - r, r * 2, r * 2)

    // community bubbles ("investigation epics")
    graph.communities.forEach((members, ci) => {
      if (members.length < 2) return
      const pts = members.flatMap((id) => {
        const n = nodesRef.current.get(id)
        return n?.x === undefined ? [] : [{ x: n.x, y: n.y ?? 0, r: n.r }]
      })
      if (pts.length < 2) return
      const color = palette.community[ci % palette.community.length]!
      const hull = bubblePoints(pts, BUBBLE_PAD)
      const mid = (i: number): [number, number] => {
        const p = hull[i]!, q = hull[(i + 1) % hull.length]!
        return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
      }
      ctx.beginPath()
      ctx.moveTo(...mid(hull.length - 1))
      hull.forEach((p, i) => ctx.quadraticCurveTo(p[0], p[1], ...mid(i)))
      ctx.closePath()
      const dim = focus && !members.some((m) => near.has(m))
      ctx.globalAlpha = dim ? 0.35 : 1
      ctx.fillStyle = color
      ctx.globalAlpha *= 0.11
      ctx.fill()
      ctx.globalAlpha = dim ? 0.2 : 0.6
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.stroke()

      // epic label: glyph + hub name + member count, centred above the bubble
      const hub = hubOf.get(ci)
      if (hub && scale >= 0.4) {
        const top = pts.reduce((p, q) => (q.y - q.r < p.y - p.r ? q : p))
        const fs = Math.min(18, Math.max(6, 10.5 / scale))
        const text = `${clip(label(hub.entity), 26).toUpperCase()} · ${members.length}`
        ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`
        const tw = ctx.measureText(text).width, gw = fs * 1.2
        const cx = top.x, cy = top.y - top.r - BUBBLE_PAD - fs * 0.9
        ctx.globalAlpha = dim ? 0.4 : 1
        const img = epicSprite(color, onSprite)
        if (img.complete) ctx.drawImage(img, cx - (tw + gw) / 2, cy - fs * 0.6, fs * 1.1, fs * 1.1)
        ctx.fillStyle = color
        ctx.textBaseline = "middle"
        ctx.textAlign = "left"
        ctx.direction = isRtlText(text) ? "rtl" : "ltr"
        ctx.fillText(text, cx - (tw + gw) / 2 + gw, cy)
      }
      ctx.globalAlpha = 1
    })
  }

  const drawNode = (node: N, ctx: CanvasRenderingContext2D, scale: number) => {
    if (!palette || node.x === undefined || node.y === undefined) return
    const { x, y, r } = node
    const style = kindStyle(node.entity.kind)
    const color = palette.kind[style.group]!
    const faded = !!focus && !near.has(node.id)
    const selected = node.id === selectedId
    ctx.globalAlpha = faded ? 0.28 : 1

    shapePath(ctx, style.shape, x, y, r + 6) // soft halo
    ctx.fillStyle = color
    ctx.globalAlpha *= 0.16
    ctx.fill()
    ctx.globalAlpha = faded ? 0.28 : 1

    if (node.entity.support && node.entity.support !== "observed") {
      shapePath(ctx, style.shape, x, y, r + 3.5) // dashed ring = not directly observed
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = color
      ctx.lineWidth = 1.25
      ctx.stroke()
      ctx.setLineDash([])
    }
    shapePath(ctx, style.shape, x, y, r)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = palette.card
    ctx.lineWidth = 2
    ctx.stroke()

    const glyph = kindSprite(node.entity.kind, onSprite)
    if (glyph.complete) {
      const g = r * 1.15
      ctx.drawImage(glyph, x - g / 2, y - g / 2, g, g)
    }
    if (selected) {
      shapePath(ctx, style.shape, x, y, r + 8)
      ctx.strokeStyle = palette.primary
      ctx.lineWidth = 2.5
      ctx.stroke()
    }

    if (scale >= 0.55 || near.has(node.id)) {
      const text = clip(label(node.entity))
      const fs = Math.min(16, Math.max(6, 11 / scale))
      ctx.font = `500 ${fs}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      ctx.direction = isRtlText(text) ? "rtl" : "ltr"
      ctx.lineJoin = "round"
      ctx.lineWidth = 3.5 / Math.max(1, scale)
      ctx.strokeStyle = palette.canvas
      ctx.strokeText(text, x, y + r + 9)
      ctx.fillStyle = palette.fg
      ctx.fillText(text, x, y + r + 9)
    }
    ctx.globalAlpha = 1
  }

  const drawLinkLabel = (link: L, ctx: CanvasRenderingContext2D, scale: number) => {
    const a = link.source as N, b = link.target as N
    if (!palette || typeof a !== "object" || typeof b !== "object") return
    if (selectedId !== a.id && selectedId !== b.id) return
    const r = link.relationship
    const text = `${r.kind.replaceAll("_", " ")}${r.strength ? ` · ${t.network[r.strength]}` : ""}`
    const fs = Math.min(14, Math.max(6, 10 / scale))
    ctx.font = `${fs}px ui-sans-serif, system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.lineWidth = 3 / Math.max(1, scale)
    ctx.strokeStyle = palette.canvas
    const mx = ((a.x ?? 0) + (b.x ?? 0)) / 2, my = ((a.y ?? 0) + (b.y ?? 0)) / 2
    ctx.strokeText(text, mx, my)
    ctx.fillStyle = palette.fg
    ctx.fillText(text, mx, my)
  }

  const linkStyle = (l: L) => {
    const a = l.source as N | string, b = l.target as N | string
    const ids = [typeof a === "object" ? a.id : a, typeof b === "object" ? b.id : b]
    const on = !!focus && ids.includes(focus)
    const base = l.relationship.strength ? STRENGTH_STYLE[l.relationship.strength] : NEUTRAL_EDGE
    return { on, faded: !!focus && !on, width: (on ? 1.5 : 1) * base.width, color: l.relationship.strength && palette ? palette.strength[l.relationship.strength] : palette?.muted ?? "#888" }
  }

  const cardEntity = card ? nodesRef.current.get(card.id)?.entity : undefined
  const cardNode = card ? nodesRef.current.get(card.id) : undefined
  const hub = cardNode ? hubOf.get(cardNode.community) : undefined
  const epic = cardNode && graph.communities[cardNode.community]!.length > 1 && hub ? label(hub.entity) : undefined

  return (
    // Canvas math is physical; keep it LTR even in Arabic.
    <div
      ref={wrapRef}
      dir="ltr"
      className="relative h-full min-h-0 overflow-hidden"
      role="img"
      aria-label={`${t.network.graphCanvas}: ${graph.nodes.length} / ${graph.links.length}`}
      style={{ background: "var(--canvas)", cursor: panActive ? "grabbing" : undefined }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.button === 1 && e.preventDefault()}
      onPointerDown={(e) => {
        const fg = fgRef.current
        if ((e.button !== 1 && e.button !== 2) || !fg || !(e.target instanceof HTMLCanvasElement)) return
        const c = fg.centerAt()
        panning.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, k: fg.zoom() }
        e.currentTarget.setPointerCapture(e.pointerId)
        setPanActive(true)
        hoverNode(null)
      }}
      onPointerUp={(e) => {
        if (!panning.current) return
        panning.current = null
        setPanActive(false)
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={() => {
        panning.current = null
        setPanActive(false)
      }}
      onPointerMove={(e) => {
        const pan = panning.current
        if (pan && fgRef.current) fgRef.current.centerAt(pan.cx - (e.clientX - pan.x) / pan.k, pan.cy - (e.clientY - pan.y) / pan.k)
        const r = e.currentTarget.getBoundingClientRect()
        pointer.current = {
          x: Math.min(Math.max(8, e.clientX - r.left + 16), Math.max(8, r.width - CARD.w - 8)),
          y: Math.min(Math.max(8, e.clientY - r.top + 18), Math.max(8, r.height - CARD.h - 8)),
        }
      }}
      onPointerLeave={() => hoverNode(null)}
    >
      {size.w > 0 && palette && (
        <ForceGraph2D<GNode, GLink>
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel={() => ""}
          nodeCanvasObjectMode={() => "replace"}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x ?? 0, node.y ?? 0, (node as N).r + 8, 0, Math.PI * 2)
            ctx.fill()
          }}
          linkColor={(l) => {
            const s = linkStyle(l)
            return s.on ? palette.primary : s.color
          }}
          linkWidth={(l) => linkStyle(l).width}
          linkLineDash={(l) => (l.relationship.support === "observed" ? null : INFERRED_DASH.split(" ").map(Number))}
          linkCanvasObjectMode={() => "after"}
          linkCanvasObject={drawLinkLabel}
          onRenderFramePre={drawBackdrop}
          onNodeHover={(n) => hoverNode((n as N) ?? null)}
          onNodeClick={(n) => onSelect(String(n.id))}
          onZoom={() => hoverNode(null)}
          enableNodeDrag
          enablePanInteraction={false}
          onNodeDrag={() => {
            clearTimeout(timer.current)
            setCard(null)
          }}
          autoPauseRedraw={false}
          warmupTicks={200}
          cooldownTicks={reduced ? 60 : 400}
          d3AlphaDecay={0.035}
        />
      )}

      {cardEntity && card && (
        <EntityHoverCard
          entity={cardEntity}
          links={cardNode?.degree ?? 0}
          epic={epic}
          x={card.x}
          y={card.y}
        />
      )}

      {overlay && <div className="absolute inset-x-0 top-3 flex justify-center">{overlay}</div>}
      {legend && (
        <div dir={dir} className={`absolute top-3 ${locale === "ar" ? "right-3" : "left-3"}`}>
          {legend}
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-lg border shadow-sm" style={{ background: "var(--card)" }}>
        <Hint label={t.network.zoomIn} side="right">
          <Button variant="ghost" size="icon-sm" aria-label={t.network.zoomIn} onClick={() => zoomBy(1.3)}><IconPlus /></Button>
        </Hint>
        <Hint label={t.network.zoomOut} side="right">
          <Button variant="ghost" size="icon-sm" aria-label={t.network.zoomOut} onClick={() => zoomBy(1 / 1.3)}><IconMinus /></Button>
        </Hint>
        <Hint label={t.network.fit} side="right">
          <Button variant="ghost" size="icon-sm" aria-label={t.network.fit} onClick={() => fit(300)}><IconFocus2 /></Button>
        </Hint>
      </div>
    </div>
  )
}
