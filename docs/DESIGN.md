# Galley design direction

The app is a bench, not a SaaS dashboard: warm stone ground, ink text, one accent per project, and every screen readable at a glance. Keep the existing palette and typefaces. Do not introduce blue/purple SaaS colour, gradients as decoration, card shadows, or a second display face.

## Non-negotiables

1. **Icons.** Use `@/components/ui/icon` only (curated Lucide set, 16px default, 1.75 stroke, `currentColor`). Never emoji, never a bare inline `<svg>` in a screen file. Icon-only buttons need `aria-label` and a `title`.
2. **One accent.** `--accent` is set per workspace on its layout. Use it for the active state, focus ring, primary button, and progress fill. Semantic colour (`review`, `done`, `late`) is separate and only for status.
3. **Type scale.** Page title `text-[22px] font-semibold tracking-tight`; section heading `text-sm font-semibold`; eyebrow/label `text-xs font-medium text-ink-3`; body 14px; small 13px; numbers always `tnum`. Copy content stays `font-serif`.
4. **Surfaces.** Hairline `border-line` over shadow. `rounded-r` (6px) for controls, `rounded-lg` (10px) for panels and cards. `shadow-panel` only on floating things (dialog, popover, drawer, drag overlay).
5. **Spacing.** 4px grid. Screen padding `px-6 py-5` desktop, `px-4 py-4` mobile. Gaps: 2 (dense rows), 3 (cards), 5–6 (sections).
6. **Motion.** 150ms ease-out on colour/opacity/transform. No layout-shifting hover. Respect `prefers-reduced-motion` (already global).
7. **Interaction.** Everything clickable gets `cursor-pointer` and a visible hover change. Focus is always visible (`focus-visible:ring-2 ring-accent`). Touch targets ≥ 40px on mobile.
8. **Density with air.** Lists are dense; the page around them is not. Cap reading columns at ~72ch, cap dashboards at `max-w-[1180px]` and centre.

## Shared building blocks (use these, do not re-invent)

| Component | Use |
|---|---|
| `ui/icon` — `<Icon name="check" />`, `<IconButton>` | all iconography |
| `ui/button` — `variant` primary/default/ghost/danger/quiet, `size` sm/md, `icon` prop | every button |
| `ui/page` — `<PageHeader title action eyebrow>`, `<Section title action>` | screen and section headings |
| `ui/meter` — `<Meter value max tone>` | progress (copy approved, tasks done, storage) |
| `ui/stat` — `<Stat label value hint>` | small figure blocks |
| `ui/empty` — `<Empty icon title hint action>` | every empty state |
| `ui/pill`, `ui/avatar`, `ui/dialog`, `ui/field`, `ui/toast`, `ui/tooltip` | as before |

## Screen patterns

- **Index screens** (workspaces, suppliers): a header row (title, count, search/filter, primary action), then a responsive card grid or a table. Cards carry: identity block (mark + name + sub), a meter or status, three facts max, and a quiet footer line.
- **Detail screens**: header band with the accent tint, tabs, then content. Never two scrollbars side by side unless the pane is a real inspector.
- **Inspectors** (task detail, section details, asset details): `bg-surface-2`, `border-l`, 320–380px, sections separated by `border-t border-line-2`, each with an eyebrow label.
- **Tables**: `text-[13px]`, header row `text-xs text-ink-3 border-b border-line`, rows `border-b border-line-2 hover:bg-surface-2`, numeric columns `tnum text-right`. Row actions are icon buttons revealed on hover but always focusable.
- **Empty states**: icon in a `bg-surface-2` circle, one sentence of what goes here, one primary action.

## Copy rules

Sentence case everywhere. Verbs, not nouns, on buttons ("Add supplier", not "New supplier form"). Say what happens, then confirm it happened in the same words. No exclamation marks.
