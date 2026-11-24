#!/usr/bin/env node
/**
 * Contrast check for the MANAA palette. Reads the OKLCH tokens straight from
 * src/styles/globals.css (the single source of truth), resolves var() aliases,
 * and applies the WCAG 2 contrast formula.
 *
 *   npm run palette:check --workspace=@workspace/ui            # exits 1 if any pair fails
 *   node packages/ui/scripts/palette-check.mjs --markdown      # tables for docs/DESIGN-PALETTE.md
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const CSS = fileURLToPath(new URL("../src/styles/globals.css", import.meta.url))
const src = readFileSync(CSS, "utf8")

function block(selector) {
  const start = src.indexOf(`\n${selector} {`)
  if (start < 0) throw new Error(`no ${selector} block in globals.css`)
  const open = src.indexOf("{", start)
  return src.slice(open + 1, src.indexOf("\n}", open))
}
function tokens(selector) {
  const out = {}
  for (const m of block(selector).matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) out[m[1]] = m[2].trim()
  return out
}
const modes = { light: tokens(":root"), dark: tokens(".dark") }

function resolve(mode, name, seen = new Set()) {
  const v = modes[mode][name]
  if (v === undefined) throw new Error(`--${name} missing in ${mode}`)
  const ref = v.match(/^var\(--([\w-]+)\)$/)
  if (ref) {
    if (seen.has(name)) throw new Error(`alias loop at --${name}`)
    return resolve(mode, ref[1], seen.add(name))
  }
  const m = v.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/)
  if (!m) throw new Error(`--${name} (${mode}) is not a plain oklch() value: ${v}`)
  return { l: +m[1], c: +m[2], h: +m[3] }
}

function rgb({ l, c, h }) {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180)
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S].map((v) => Math.min(1, Math.max(0, v)))
}
const lum = (o) => { const [r, g, b] = rgb(o); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const gamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
const hex = (o) => "#" + rgb(o).map((v) => Math.round(gamma(v) * 255).toString(16).padStart(2, "0")).join("")
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

const SIGNALS = ["red", "orange", "amber", "green", "blue", "teal", "slate"]
const STROKES = ["strength-strong", "strength-medium", "strength-weak", "kind-org", "kind-identity", "kind-web", "kind-content", "kind-infra", "kind-money", "community-1", "community-2", "community-3", "community-4", "community-5", "community-6"]
const ALIASES = ["support-observed", "support-possible", "support-disputed", "status-open", "status-overdue", "status-closed", "priority-high", "priority-medium", "priority-low"]

const rows = []
for (const mode of ["light", "dark"]) {
  const t = (n) => resolve(mode, n)
  const add = (name, fg, bg, min) => rows.push({ mode, name, ratio: ratio(t(fg), t(bg)), min })
  add("foreground / background", "foreground", "background", 7)
  add("card-foreground / card", "card-foreground", "card", 7)
  add("muted-foreground / background", "muted-foreground", "background", 4.5)
  add("muted-foreground / muted", "muted-foreground", "muted", 4.5)
  add("primary-foreground / primary", "primary-foreground", "primary", 4.5)
  add("primary (link text) / background", "primary", "background", 4.5)
  add("accent-foreground / accent", "accent-foreground", "accent", 4.5)
  add("secondary-foreground / secondary", "secondary-foreground", "secondary", 4.5)
  add("destructive / background", "destructive", "background", 4.5)
  add("ring / background (focus, non-text)", "ring", "background", 3)
  for (const s of SIGNALS) {
    add(`signal-${s} / its soft tint`, `signal-${s}`, `signal-${s}-soft`, 4.5)
    add(`signal-${s} / card`, `signal-${s}`, "card", 4.5)
  }
  for (const a of ALIASES) add(`${a} / its soft tint`, a, `${a}-soft`, 4.5)
  for (const s of STROKES) add(`${s} / background (non-text)`, s, "background", 3)
  add("header-foreground / header", "header-foreground", "header", 7)
  add("header-muted / header", "header-muted", "header", 4.5)
  add("header-accent / header (non-text)", "header-accent", "header", 3)
  add("header-cta-foreground / header-cta", "header-cta-foreground", "header-cta", 4.5)
  add("header-cta / header (non-text)", "header-cta", "header", 3)
  add("foreground / canvas", "foreground", "canvas", 7)
  add("card / canvas (card edge visible, non-text)", "card", "canvas", 1.0)
}
const fails = rows.filter((r) => r.ratio < r.min)

if (process.argv.includes("--markdown")) {
  const sw = (mode, n) => `\`${hex(resolve(mode, n))}\``
  const out = ["| Token | Light | Dark |", "| --- | --- | --- |"]
  for (const n of ["background", "foreground", "card", "primary", "primary-foreground", "secondary", "muted", "muted-foreground", "accent", "accent-foreground", "destructive", "border", "ring", "canvas", "header", "header-accent", "header-cta"])
    out.push(`| \`${n}\` | ${sw("light", n)} | ${sw("dark", n)} |`)
  out.push("", "| Signal | Strong (light) | Soft (light) | Strong (dark) | Soft (dark) |", "| --- | --- | --- | --- | --- |")
  for (const s of SIGNALS) out.push(`| \`${s}\` | ${sw("light", `signal-${s}`)} | ${sw("light", `signal-${s}-soft`)} | ${sw("dark", `signal-${s}`)} | ${sw("dark", `signal-${s}-soft`)} |`)
  out.push("", "| Graph stroke | Light | Dark | Contrast vs canvas (light / dark) |", "| --- | --- | --- | --- |")
  for (const s of STROKES) {
    const f = (m) => ratio(resolve(m, s), resolve(m, "background")).toFixed(1)
    out.push(`| \`${s}\` | ${sw("light", s)} | ${sw("dark", s)} | ${f("light")} / ${f("dark")} |`)
  }
  out.push("", "| Pair | Min | Light | Dark |", "| --- | --- | --- | --- |")
  for (const n of [...new Set(rows.map((r) => r.name))]) {
    const l = rows.find((r) => r.mode === "light" && r.name === n), d = rows.find((r) => r.mode === "dark" && r.name === n)
    out.push(`| ${n} | ${l.min} | ${l.ratio.toFixed(1)} | ${d.ratio.toFixed(1)} |`)
  }
  console.log(out.join("\n"))
} else {
  for (const f of fails) console.error(`FAIL ${f.mode}: ${f.name} = ${f.ratio.toFixed(2)} (needs ${f.min})`)
  console.log(`${rows.length - fails.length}/${rows.length} palette pairs pass`)
  process.exit(fails.length ? 1 : 0)
}
