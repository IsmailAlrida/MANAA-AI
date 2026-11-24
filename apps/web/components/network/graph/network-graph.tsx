"use client"

import * as React from "react"
import { IconFocus2, IconMinus, IconPlus } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import {
  curveCatmullRomClosed,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  line,
  select,
  zoom,
  zoomIdentity,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3"

import { entityLabel, type GraphEntity, type GraphRelationship } from "@/lib/api/types"
import { useLocale } from "@/lib/i18n"
import { useWorkspace } from "@/lib/workspace/store"
import { Hint } from "../../hint"
import { INFERRED_DASH, NEUTRAL_EDGE, STRENGTH_STYLE } from "./edge-style"
import { bubblePoints, buildDotGraph, dotRadius, type DotGraph } from "./graph-model"
import { kindGroup } from "./kind-icon"

type SimNode = SimulationNodeDatum & { id: string; r: number; community: number }
type SimLink = SimulationLinkDatum<SimNode> & { id: string }

const DISTANCE = { strong: 120, medium: 165, weak: 230 } as const
const BUBBLE_PAD = 30
const MARGIN = 64
const LEGEND_ROOM = 204
const COMMUNITY_COLORS = 6
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const clip = (s: string, n = 24) => (s.length > n ? s.slice(0, n - 1) + "…" : s)
const bubbleLine = line<[number, number]>().curve(curveCatmullRomClosed.alpha(0.6))

/** Pull each node toward its community's centroid so groups read as groups. */
function communityForce(strength: number) {
  let nodes: SimNode[] = []
  const force = (alpha: number) => {
    const sums = new Map<number, { x: number; y: number; n: number }>()
    for (const n of nodes) {
      const s = sums.get(n.community) ?? { x: 0, y: 0, n: 0 }
      s.x += n.x ?? 0
      s.y += n.y ?? 0
      s.n++
      sums.set(n.community, s)
    }
    for (const n of nodes) {
      const s = sums.get(n.community)!
      if (s.n < 2) continue
      n.vx = (n.vx ?? 0) + (s.x / s.n - (n.x ?? 0)) * strength * alpha
      n.vy = (n.vy ?? 0) + (s.y / s.n - (n.y ?? 0)) * strength * alpha
    }
  }
  force.initialize = (n: SimNode[]) => void (nodes = n)
  return force
}

/**
 * Honest relationship graph: entities are dots, relationships are links, and
 * the layout and the bubbles come from the data (force simulation + community
 * detection). The camera frames the graph once when it first has content and
 * never moves on its own afterwards, so streamed updates don't yank it.
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
  const graph = React.useMemo(() => buildDotGraph(entities, relationships), [entities, relationships])

  const wrapRef = React.useRef<HTMLDivElement>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const simRef = React.useRef<Simulation<SimNode, SimLink> | null>(null)
  const nodesRef = React.useRef(new Map<string, SimNode>())
  const zoomRef = React.useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const fittedRef = React.useRef(false)
  const raf = React.useRef(0)
  const [, setFrame] = React.useState(0)
  const [size, setSize] = React.useState({ w: 0, h: 0 })
  const [view, setView] = React.useState<ZoomTransform>(zoomIdentity)
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [focused, setFocused] = React.useState<string | null>(null)
  const reduced = React.useRef(false)
  const kRef = React.useRef(1)

  const bump = React.useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => setFrame((f) => f + 1))
  }, [])

  /* ---- simulation: created once ---- */
  React.useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const sim = forceSimulation<SimNode>()
      .force("charge", forceManyBody<SimNode>().strength(-720).distanceMax(900))
      .force("collide", forceCollide<SimNode>((n) => n.r + 30))
      .force("x", forceX<SimNode>(0).strength(0.035))
      .force("y", forceY<SimNode>(0).strength(0.035))
      .force("community", communityForce(0.22))
      .alphaDecay(0.035)
      .on("tick", bump)
    simRef.current = sim
    return () => {
      sim.stop()
      cancelAnimationFrame(raf.current)
    }
  }, [bump])

  /* ---- size ---- */
  React.useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ---- data → simulation (existing dots keep their place; new ones enter beside a neighbour) ---- */
  React.useEffect(() => {
    const sim = simRef.current
    if (!sim) return
    const prev = nodesRef.current
    const next = new Map<string, SimNode>()
    const neighbours = (id: string) =>
      graph.links.flatMap((l) => (l.source === id ? [l.target] : l.target === id ? [l.source] : []))
    for (const n of graph.nodes) {
      const old = prev.get(n.id)
      let x = old?.x, y = old?.y
      if (x === undefined || y === undefined) {
        const anchor = neighbours(n.id).map((id) => prev.get(id)).find((p) => p?.x !== undefined)
        const a = (hash(n.id) % 360) * (Math.PI / 180)
        x = (anchor?.x ?? 0) + Math.cos(a) * 60
        y = (anchor?.y ?? 0) + Math.sin(a) * 60
      }
      next.set(n.id, { id: n.id, r: dotRadius(n.degree), community: n.community, x, y, vx: old?.vx, vy: old?.vy })
    }
    nodesRef.current = next
    const nodes = [...next.values()]
    const links: SimLink[] = graph.links.map((l) => ({ id: l.id, source: l.source, target: l.target }))
    const byId = new Map(graph.links.map((l) => [l.id, l]))
    sim.nodes(nodes)
    sim.force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((n) => n.id)
        .distance((l) => DISTANCE[byId.get(l.id)?.relationship.strength ?? "weak"])
        .strength((l) => (byId.get(l.id)?.relationship.strength === "weak" ? 0.25 : 0.6))
    )
    if (reduced.current || !fittedRef.current) sim.stop()
    else sim.alpha(0.25).restart()
    bump()
  }, [graph, bump])

  /* ---- camera: pan / pinch only by the operator ---- */
  const fit = React.useCallback(() => {
    const svg = svgRef.current, z = zoomRef.current
    const nodes = [...nodesRef.current.values()]
    if (!svg || !z || nodes.length === 0 || size.w === 0) return
    const pad = BUBBLE_PAD + MARGIN
    const LABEL = 90 // labels can sit beside a dot; keep them inside the frame
    const xs = nodes.flatMap((n) => [(n.x ?? 0) - n.r - pad - LABEL * 0.6, (n.x ?? 0) + n.r + pad + LABEL])
    const ys = nodes.flatMap((n) => [(n.y ?? 0) - n.r - pad, (n.y ?? 0) + n.r + pad])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const room = legend && legendOpen ? LEGEND_ROOM : 0
    const start = locale === "ar" ? 0 : room // free area starts after the legend on the start side
    const freeW = size.w - room
    const k = Math.min(1.5, freeW / (x1 - x0), size.h / (y1 - y0))
    const tx = start + (freeW - (x1 - x0) * k) / 2 - x0 * k
    const ty = (size.h - (y1 - y0) * k) / 2 - y0 * k
    select(svg).call(z.transform, zoomIdentity.translate(tx, ty).scale(k))
  }, [size, legend, legendOpen, locale])

  React.useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .filter((e: Event) => e.type !== "wheel" && !(e as MouseEvent).button)
      .on("zoom", (e) => {
        kRef.current = e.transform.k
        setView(e.transform)
      })
    zoomRef.current = z
    const sel = select(svg).call(z)
    // Two-finger scroll pans; pinch / ctrl+scroll zooms.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const r = svg.getBoundingClientRect()
        sel.call(z.scaleBy, Math.exp(-e.deltaY * 0.01), [e.clientX - r.left, e.clientY - r.top])
      } else sel.call(z.translateBy, -e.deltaX / kRef.current, -e.deltaY / kRef.current)
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      svg.removeEventListener("wheel", onWheel)
      sel.on(".zoom", null)
    }
  }, [])

  /* ---- first frame: settle off-screen, then frame once ---- */
  React.useEffect(() => {
    const sim = simRef.current
    if (!sim || fittedRef.current || graph.nodes.length === 0 || size.w === 0) return
    sim.alpha(1).stop()
    sim.tick(260)
    fittedRef.current = true
    fit()
    bump()
  }, [graph, size, fit, bump])

  const zoomBy = (f: number) => svgRef.current && zoomRef.current && select(svgRef.current).call(zoomRef.current.scaleBy, f)

  /* ---- derived drawing data ---- */
  const nodeOf = (id: string) => nodesRef.current.get(id)
  const active = hovered ?? focused
  const focus = active ?? selectedId
  const nearby = new Set<string>()
  if (focus) {
    nearby.add(focus)
    for (const l of graph.links) {
      if (l.source === focus) nearby.add(l.target)
      if (l.target === focus) nearby.add(l.source)
    }
  }
  const label = (e: GraphEntity) => entityLabel(e, locale) ?? e.id
  // Labels point away from their cluster's centre, so neighbours in a group don't print over each other.
  const centroids = new Map<number, { x: number; y: number; n: number }>()
  for (const n of graph.nodes) {
    const s = nodeOf(n.id)
    if (!s) continue
    const c = centroids.get(n.community) ?? { x: 0, y: 0, n: 0 }
    c.x += s.x ?? 0
    c.y += s.y ?? 0
    c.n++
    centroids.set(n.community, c)
  }
  const labelSpot = (n: { id: string; community: number }, s: SimNode) => {
    const c = centroids.get(n.community)
    if (!c || c.n < 2) return { x: 0, y: s.r + 20, anchor: "middle" as const }
    const dx = (s.x ?? 0) - c.x / c.n, dy = (s.y ?? 0) - c.y / c.n
    if (Math.abs(dx) > Math.abs(dy) * 0.7) return { x: Math.sign(dx) * (s.r + 12), y: 4, anchor: dx > 0 ? ("start" as const) : ("end" as const) }
    return { x: 0, y: dy > 0 ? s.r + 20 : -(s.r + 12), anchor: "middle" as const }
  }

  return (
    // Canvas math is physical; keep it LTR even in Arabic. Text uses dir="auto".
    <div ref={wrapRef} dir="ltr" className="relative h-full min-h-0 overflow-hidden" style={{ background: "var(--canvas)" }}>
      <svg
        ref={svgRef}
        className="absolute inset-0 size-full touch-none select-none"
        role="group"
        aria-label={t.network.graphCanvas}
      >
        <defs>
          <pattern id="graph-dots" width={24 * view.k} height={24 * view.k} x={view.x} y={view.y} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={Math.max(0.8, 1.2 * view.k)} style={{ fill: "var(--grid-dot)" }} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#graph-dots)" />

        <g transform={view.toString()}>
          {/* community bubbles */}
          {graph.communities.map((members, ci) => {
            if (members.length < 2) return null
            const pts = members.flatMap((id) => {
              const n = nodeOf(id)
              return n ? [{ x: n.x ?? 0, y: n.y ?? 0, r: n.r }] : []
            })
            if (pts.length < 2) return null
            const color = `var(--community-${(ci % COMMUNITY_COLORS) + 1})`
            const top = pts.reduce((a, b) => (b.y - b.r < a.y - a.r ? b : a))
            const hub = graph.nodes.filter((n) => n.community === ci).sort((a, b) => b.degree - a.degree)[0]
            const dim = focus && !members.some((m) => nearby.has(m))
            return (
              <g key={ci} style={{ opacity: dim ? 0.35 : 1, transition: "opacity 150ms" }}>
                <path
                  d={bubbleLine(bubblePoints(pts, BUBBLE_PAD)) ?? ""}
                  style={{
                    fill: `color-mix(in oklch, ${color} 11%, transparent)`,
                    stroke: `color-mix(in oklch, ${color} 55%, transparent)`,
                    strokeWidth: 1.5,
                  }}
                />
                {hub && (
                  <text
                    x={top.x}
                    y={top.y - top.r - BUBBLE_PAD - 7}
                    textAnchor="middle"
                    className="text-[10px] font-semibold uppercase tracking-wide [unicode-bidi:plaintext]"
                    style={{ fill: color }}
                  >
                    {clip(label(hub.entity), 28)} · {members.length}
                  </text>
                )}
              </g>
            )
          })}

          {/* links */}
          {graph.links.map((l) => {
            const a = nodeOf(l.source), b = nodeOf(l.target)
            if (!a || !b) return null
            const r = l.relationship
            const base = r.strength ? STRENGTH_STYLE[r.strength] : NEUTRAL_EDGE
            const on = focus === l.source || focus === l.target
            const labelled = selectedId === l.source || selectedId === l.target
            const faded = !!focus && !on
            const inferred = r.support !== "observed"
            const mx = ((a.x ?? 0) + (b.x ?? 0)) / 2, my = ((a.y ?? 0) + (b.y ?? 0)) / 2
            return (
              <g key={l.id} style={{ opacity: faded ? 0.14 : 1, transition: "opacity 150ms" }}>
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  strokeLinecap="round"
                  strokeDasharray={inferred ? INFERRED_DASH : undefined}
                  style={{ stroke: on ? "var(--primary)" : base.color, strokeWidth: (on ? 1.5 : 1) * base.width }}
                >
                  <title>{r.rationaleVariants?.[locale] ?? r.rationale ?? r.kind}</title>
                </line>
                {labelled && (
                  <text
                    x={mx} y={my - 5} textAnchor="middle"
                    className="pointer-events-none text-[10px] [unicode-bidi:plaintext]"
                    style={{ fill: "var(--foreground)", paintOrder: "stroke", stroke: "var(--canvas)", strokeWidth: 3 }}
                  >
                    {r.kind.replaceAll("_", " ")}{r.strength ? ` · ${t.network[r.strength]}` : ""}
                  </text>
                )}
              </g>
            )
          })}

          {/* dots */}
          {graph.nodes.map((n) => {
            const s = nodeOf(n.id)
            if (!s) return null
            const e = n.entity
            const fill = `var(--kind-${kindGroup(e.kind)})`
            const isSel = n.id === selectedId
            const faded = !!focus && !nearby.has(n.id)
            const showLabel = view.k >= 0.55 || nearby.has(n.id)
            const spot = labelSpot(n, s)
            return (
              <g
                key={n.id}
                transform={`translate(${s.x ?? 0} ${s.y ?? 0})`}
                tabIndex={0}
                role="button"
                aria-label={`${e.kind}: ${label(e)}`}
                aria-pressed={isSel}
                className="cursor-pointer outline-none"
                style={{ opacity: faded ? 0.28 : 1, transition: "opacity 150ms" }}
                onPointerEnter={() => setHovered(n.id)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setFocused(n.id)}
                onBlur={() => setFocused(null)}
                onClick={() => onSelect(n.id)}
                onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), onSelect(n.id))}
              >
                {(isSel || focused === n.id) && (
                  <circle r={s.r + 7} fill="none" style={{ stroke: "var(--primary)", strokeWidth: 2.5 }} />
                )}
                {e.support && e.support !== "observed" && (
                  <circle r={s.r + 3.5} fill="none" strokeDasharray="3 3" style={{ stroke: fill, strokeWidth: 1.25 }} />
                )}
                <circle r={s.r + 6} style={{ fill: `color-mix(in oklch, ${fill} 16%, transparent)` }} />
                <circle r={s.r} style={{ fill, stroke: "var(--card)", strokeWidth: 2 }} />
                {showLabel && (
                  <text
                    x={spot.x} y={spot.y} textAnchor={spot.anchor}
                    className="text-[11px] font-medium [unicode-bidi:plaintext]"
                    style={{ fill: "var(--foreground)", paintOrder: "stroke", stroke: "var(--canvas)", strokeWidth: 3.5 }}
                  >
                    {clip(label(e))}
                  </text>
                )}
                <title>{`${label(e)} — ${e.kind}`}</title>
              </g>
            )
          })}
        </g>
      </svg>

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
          <Button variant="ghost" size="icon-sm" aria-label={t.network.fit} onClick={fit}><IconFocus2 /></Button>
        </Hint>
      </div>
    </div>
  )
}

export type { DotGraph }
