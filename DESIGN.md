# Replyza Buzz — Design System (`DESIGN.md`)

## 1. Visual Identity & Aesthetic Direction
Replyza Buzz is an **editorial, tactile, high-craft creator-commerce workspace** inspired by Linear, Stripe, and Raycast.
- **No AI Clichés**: Strictly zero purple/blue/pink gradients, zero neon glows, zero floating blob backgrounds, and zero generic AI buzzwords ("Elevate", "Unleash", "Supercharge", "Seamless", "Game-changer").
- **Tactile Hairline Surfaces**: Structure is created through crisp `1px` borders (`#E6E5E1`) and subtle tonal elevation (`#FAF9F6` canvas → `#FFFFFF` elevated surface) rather than heavy drop shadows.

---

## 2. Color Tokens

| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--bg-canvas` | `#FAF9F6` | Primary warm alabaster page background |
| `--bg-surface` | `#FFFFFF` | Elevated cards, tables, modals, DM phone frame |
| `--bg-subtle` | `#F3F2EE` | Secondary panels, table headers, input wells, hover states |
| `--border-hairline` | `#E6E5E1` | Standard 1px structural borders & dividers |
| `--border-strong` | `#D1CFC9` | Active/focused borders & interactive outlines |
| `--text-primary` | `#141413` | Deep ink charcoal headings, primary body copy, active nav |
| `--text-secondary` | `#5C5B57` | Descriptions, table secondary cells, metadata |
| `--text-muted` | `#8C8A84` | Timestamps, placeholders, axis labels |
| `--accent-primary` | `#D94E28` | Warm vermilion/coral brand accent (CTAs, active highlights, trigger badges) |
| `--accent-primary-hover` | `#C0421F` | Hover state for primary accent |
| `--accent-primary-soft` | `#FDF2EE` | Subtle tinted badge/alert background |
| `--status-success` | `#0D7A5F` | Deep emerald for Active automations, verified follows, delivered DMs |
| `--status-success-soft` | `#ECF7F3` | Emerald badge background |
| `--status-warning` | `#B45309` | Amber for Drafts, rate-limit notices, variable warnings |
| `--status-danger` | `#C81E1E` | Crimson for Failed deliveries & destructive actions |

---

## 3. Typography

- **Display & Body (`--font-sans`)**: `Plus Jakarta Sans`
  - Page titles: `20px–24px`, `font-weight: 700`, `letter-spacing: -0.025em`, `line-height: 1.2`
  - Section headings: `15px–16px`, `font-weight: 600`, `letter-spacing: -0.015em`
  - Body & UI labels: `13px–14px`, `line-height: 1.5`
- **Monospace (`--font-mono`)**: `JetBrains Mono` with `font-variant-numeric: tabular-nums`
  - Used for KPI counters, DM delivery counts, trigger keywords (`LINK`, `SHOP`), webhook timestamps, and template variables (`{{product_url}}`).

---

## 4. Layout, Spacing & Radius
- **Radius**: `8px` (`rounded-lg`) for inputs, buttons, and table rows; `12px` (`rounded-xl`) for cards and builder panels; `9999px` only for small status dots/pills.
- **Dashboard Shell**: Fixed `240px` left sidebar (`#FAF9F6` with `1px` right border `#E6E5E1`), `56px` topbar with breadcrumbs, and `max-w-7xl` content container.
- **Builder**: 2-column desktop split (`1fr` configuration flow on left, `380px` sticky Instagram mobile DM simulator on right).

---

## 5. Copywriting Principles
- Direct, specific creator-commerce language.
- State exact Meta API mechanics (e.g., "Sends within the 24-hour DM window", "1 private reply per comment").
- Never use filler adjectives.
