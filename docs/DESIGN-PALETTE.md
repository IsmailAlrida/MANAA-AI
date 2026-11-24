# Design palette

**Status:** 2026-11-24. Implemented as CSS tokens in `packages/ui/src/styles/globals.css`; the tables below are generated from those tokens by `packages/ui/scripts/palette-check.mjs --markdown`, so the CSS is the single source of truth.

## Direction

A calm security-operations tool, not a marketing page. White canvas, deep navy ink, one clear blue for action, and a small set of **signal** colours that each carry a meaning. Saturated colour is reserved for state (support, status, priority, link strength, entity type); everything else stays neutral.

- **Source:** the "teal on paper" and "frost and slate" families from the installed `taste-skill` palette dealer (off-white ground, cool slate neutrals, teal-blue accent), re-tuned for a dense dashboard. Its marketing-site rules (heroes, photography, shader scenes, one-section-per-screen) are deliberately not applied; they conflict with the PRD.
- **No violet or lavender**, per that skill's rule; entity types use blue, rose, teal, orange, slate and green.
- **Never colour alone.** Every colour sits next to text, an icon, a line style or a position: support, status and priority badges carry a label and icon; link strength also changes line weight; "not directly observed" is a dashed line.
- **Both themes** are defined together and checked together.

## Core tokens

Overrides of the shadcn tokens (same names, so every shadcn component picks them up).

| Token | Light | Dark |
| --- | --- | --- |
| `background` | `#e9f4fc` | `#091018` |
| `foreground` | `#111f31` | `#edf3f6` |
| `card` | `#ffffff` | `#101a25` |
| `primary` | `#006ba6` | `#37b2e8` |
| `primary-foreground` | `#f4fbff` | `#071727` |
| `secondary` | `#e9f2f7` | `#1d2732` |
| `muted` | `#eaf1f6` | `#1e2731` |
| `muted-foreground` | `#4f5f71` | `#9cadbd` |
| `accent` | `#d2f2fa` | `#133446` |
| `accent-foreground` | `#003851` | `#e1f2f9` |
| `destructive` | `#c92324` | `#fa6863` |
| `border` | `#cbdae5` | `#29343f` |
| `ring` | `#1c90cb` | `#369dd1` |
| `canvas` | `#e4f2fc` | `#050b16` |
| `header` | `#07254f` | `#07254f` |
| `header-accent` | `#00ddfc` | `#00ddfc` |
| `header-cta` | `#00d8eb` | `#00d8eb` |

## Signals

Each signal has a **strong** colour (text, icon, stroke) and a **soft** tint (background). Strong on soft, and strong on the card, both meet 4.5:1 in both themes.

| Signal | Used for |
| --- | --- |
| `red` | disputed support, high priority |
| `orange` | overdue status |
| `amber` | possible support, medium priority |
| `green` | observed support |
| `blue` | open status |
| `teal` | provenance and evidence accents |
| `slate` | closed status, low priority, neutral |

| Signal | Strong (light) | Soft (light) | Strong (dark) | Soft (dark) |
| --- | --- | --- | --- | --- |
| `red` | `#b7191c` | `#ffeae7` | `#ff9890` | `#4b1d1b` |
| `orange` | `#a44000` | `#ffecdc` | `#fea668` | `#45240f` |
| `amber` | `#815800` | `#fff3ce` | `#ebc166` | `#3e2d04` |
| `green` | `#00673f` | `#dffaea` | `#68d7a1` | `#113323` |
| `blue` | `#0064a3` | `#dff3ff` | `#75c8fc` | `#0a3149` |
| `teal` | `#006768` | `#dcf9f8` | `#65d2d2` | `#003333` |
| `slate` | `#414f5d` | `#e8edf3` | `#b6c6d7` | `#262f38` |

Semantic aliases are tokens too: `--support-observed|possible|disputed`, `--status-open|overdue|closed`, `--priority-high|medium|low`, each with a `-soft` pair. Use `tone("support-observed")` from `apps/web/components/tone.ts` for the standard tinted badge.

## Header and surfaces

The top bar is a deep-navy band (`--header`) with a bright cyan accent (`--header-accent`, `--header-cta`). Everything inside it is re-themed by one `.header-scope` class that remaps the shadcn tokens, so buttons, badges and toggles need no per-component styling. The page canvas is a cool blue-grey tint (`--background`, `--canvas`) so white cards (the ticket queue, the report, the inspector) lift off it. The `ecc:taste` skill is a music-video skill; only its "one strong accent per region" idea was used.

## Graph

Link strength is drawn by colour **and** weight (3 / 2 / 1.25 px); a dashed line means the link is not directly observed. Entities are drawn as a shape + glyph in one of six colour families (circle = person, rounded square = company or bank, hexagon = server, diamond = transaction), with a soft halo; size grows with the number of links. Communities are found from the relationships (Louvain, weighted by link strength) unless the backend names one in `attributes.community`, and each community of two or more gets a tinted bubble in one of six `--community-*` hues, labelled with its best-connected entity; unknown kinds fall back to the neutral `infra` tone. The legend component reads the same tables as the edges and nodes (`edge-style.ts`, `kindGroup`), so it cannot drift.

| Entity kinds | Family |
| --- | --- |
| company | `kind-org` |
| person, social account | `kind-identity` |
| url, website, link | `kind-web` |
| ad, social post, marketplace listing | `kind-content` |
| server, unknown | `kind-infra` |
| bank account, transaction | `kind-money` |

| Graph stroke | Light | Dark | Contrast vs canvas (light / dark) |
| --- | --- | --- | --- |
| `strength-strong` | `#005290` | `#6cc9ff` | 7.2 / 10.4 |
| `strength-medium` | `#197cb3` | `#4b9bcf` | 4.1 / 6.2 |
| `strength-weak` | `#5985aa` | `#4e7698` | 3.5 / 4.0 |
| `kind-org` | `#0062a1` | `#6bb9f8` | 5.8 / 9.0 |
| `kind-identity` | `#b93f65` | `#fa89a5` | 4.8 / 8.3 |
| `kind-web` | `#007373` | `#5ecbcb` | 5.1 / 9.9 |
| `kind-content` | `#bb550e` | `#f7a062` | 4.2 / 9.2 |
| `kind-infra` | `#4a5666` | `#9eacbe` | 6.7 / 8.3 |
| `kind-money` | `#1e7546` | `#73ce95` | 5.1 / 10.0 |
| `community-1` | `#006aaa` | `#66c2fb` | 5.2 / 9.7 |
| `community-2` | `#00756b` | `#63ccc0` | 5.0 / 10.0 |
| `community-3` | `#b45000` | `#fea668` | 4.6 / 9.9 |
| `community-4` | `#357426` | `#85cc87` | 5.1 / 10.0 |
| `community-5` | `#a13b85` | `#f294ca` | 5.4 / 9.0 |
| `community-6` | `#805d00` | `#e0c16d` | 5.4 / 10.9 |

## Contrast checks

WCAG 2 contrast ratios, computed from the tokens. Text pairs need 4.5:1 (7:1 for body text), non-text UI needs 3:1. Run `npm run palette:check --workspace=@workspace/ui` to re-verify after any change; it exits non-zero on a failing pair.

| Pair | Min | Light | Dark |
| --- | --- | --- | --- |
| foreground / background | 7 | 15.0 | 17.0 |
| card-foreground / card | 7 | 16.7 | 15.6 |
| muted-foreground / background | 4.5 | 5.8 | 8.3 |
| muted-foreground / muted | 4.5 | 5.7 | 6.5 |
| primary-foreground / primary | 4.5 | 5.5 | 7.5 |
| primary (link text) / background | 4.5 | 5.2 | 7.9 |
| accent-foreground / accent | 4.5 | 10.6 | 11.3 |
| secondary-foreground / secondary | 4.5 | 12.0 | 12.3 |
| destructive / background | 4.5 | 5.0 | 6.6 |
| ring / background (focus, non-text) | 3 | 3.2 | 6.3 |
| signal-red / its soft tint | 4.5 | 5.7 | 6.8 |
| signal-red / card | 4.5 | 6.6 | 8.4 |
| signal-orange / its soft tint | 4.5 | 5.5 | 7.2 |
| signal-orange / card | 4.5 | 6.4 | 9.1 |
| signal-amber / its soft tint | 4.5 | 5.7 | 7.8 |
| signal-amber / card | 4.5 | 6.3 | 10.3 |
| signal-green / its soft tint | 4.5 | 6.3 | 7.8 |
| signal-green / card | 4.5 | 7.0 | 9.9 |
| signal-blue / its soft tint | 4.5 | 5.5 | 7.4 |
| signal-blue / card | 4.5 | 6.2 | 9.5 |
| signal-teal / its soft tint | 4.5 | 6.0 | 7.7 |
| signal-teal / card | 4.5 | 6.7 | 9.7 |
| signal-slate / its soft tint | 4.5 | 7.2 | 7.8 |
| signal-slate / card | 4.5 | 8.4 | 10.1 |
| support-observed / its soft tint | 4.5 | 6.3 | 7.8 |
| support-possible / its soft tint | 4.5 | 5.7 | 7.8 |
| support-disputed / its soft tint | 4.5 | 5.7 | 6.8 |
| status-open / its soft tint | 4.5 | 5.5 | 7.4 |
| status-overdue / its soft tint | 4.5 | 5.5 | 7.2 |
| status-closed / its soft tint | 4.5 | 7.2 | 7.8 |
| priority-high / its soft tint | 4.5 | 5.7 | 6.8 |
| priority-medium / its soft tint | 4.5 | 5.7 | 7.8 |
| priority-low / its soft tint | 4.5 | 7.2 | 7.8 |
| strength-strong / background (non-text) | 3 | 7.2 | 10.4 |
| strength-medium / background (non-text) | 3 | 4.1 | 6.2 |
| strength-weak / background (non-text) | 3 | 3.5 | 4.0 |
| kind-org / background (non-text) | 3 | 5.8 | 9.0 |
| kind-identity / background (non-text) | 3 | 4.8 | 8.3 |
| kind-web / background (non-text) | 3 | 5.1 | 9.9 |
| kind-content / background (non-text) | 3 | 4.2 | 9.2 |
| kind-infra / background (non-text) | 3 | 6.7 | 8.3 |
| kind-money / background (non-text) | 3 | 5.1 | 10.0 |
| community-1 / background (non-text) | 3 | 5.2 | 9.7 |
| community-2 / background (non-text) | 3 | 5.0 | 10.0 |
| community-3 / background (non-text) | 3 | 4.6 | 9.9 |
| community-4 / background (non-text) | 3 | 5.1 | 10.0 |
| community-5 / background (non-text) | 3 | 5.4 | 9.0 |
| community-6 / background (non-text) | 3 | 5.4 | 10.9 |
| header-foreground / header | 7 | 14.1 | 14.1 |
| header-muted / header | 4.5 | 8.7 | 8.2 |
| header-accent / header (non-text) | 3 | 9.2 | 9.2 |
| header-cta-foreground / header-cta | 4.5 | 10.4 | 10.4 |
| header-cta / header (non-text) | 3 | 8.7 | 8.7 |
| foreground / canvas | 7 | 14.7 | 17.5 |
| card / canvas (card edge visible, non-text) | 1 | 1.1 | 1.1 |



## Using it

- Prefer the tokens (`var(--support-observed)`, `bg-support-observed-soft`) over raw colours. Tailwind utilities for every new token are mapped in `@theme inline`.
- Add a colour only by adding a token to both `:root` and `.dark`, then run the check.
- Tailwind stays limited to layout glue; colour comes from tokens.
