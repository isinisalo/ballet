---
name: Ballet
version: alpha
colors:
  surface: '#111316'
  surface-dim: '#111316'
  surface-bright: '#37393d'
  surface-container-lowest: '#0c0e11'
  surface-container-low: '#1a1c1f'
  surface-container: '#1e2023'
  surface-container-high: '#282a2d'
  surface-container-highest: '#333538'
  on-surface: '#e2e2e6'
  on-surface-variant: '#c1c6d7'
  inverse-surface: '#e2e2e6'
  inverse-on-surface: '#2f3034'
  outline: '#8b90a0'
  outline-variant: '#414755'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e69'
  primary-container: '#4b8eff'
  on-primary-container: '#00285c'
  inverse-primary: '#005bc1'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  background: '#0c0e11'
  on-background: '#e2e2e6'
  surface-variant: '#333538'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-desktop: 24px
  margin-mobile: 16px
  panel-padding: 20px
  control-height-compact: 28px
  control-height-default: 32px
  control-height-mobile: 40px
---

## Brand and visual language

Ballet is a dense, calm cyber-industrial command center. Dark tonal surfaces support long sessions; mint marks validated/safe state, amber marks attention and retry, red marks blocking failure, and blue marks selection or primary action. Every semantic color has a text label or icon-and-label equivalent.

Inter owns prose and hierarchy; Geist owns IDs, hashes, statuses and compact metadata. The spacing rhythm is 4 px and panels use restrained radii and one-pixel boundaries. There are no decorative gradients, freeform topology canvases, ornamental space art or reward/policy matrices.

## Information architecture

- **Direction** shows Goals, ADRs and Constraints as linked decision context.
- **Use Cases** makes approval status, semantic hash and Given/When/Then evidence explicit.
- **Environment** presents States in ascending order as deterministic lanes or stacked sections.
- **State** presents Actions in ascending priority with stable IDs, role resources, retry budget and factual status.
- **Action flow** makes Validation the primary controller and Work subordinate: precheck -> optional Work -> postwork -> done/retry/blocked.
- **Run Gate** explains why a State or Action can or cannot advance without inventing client-owned control state.
- **Feedback Box** groups open, refinement and resolved entries with provenance.
- **Critic review** separates a read-only proposal from the human decision that may create Feedback.
- **Refinement review** shows exact paths, operations, preimage/result hashes, diff and impact before approval.
- **Product Snapshot** projects the terminal commit, artifacts, evidence and continuation lineage.

## Layout contracts

At 1440x900, a persistent compact sidebar and multi-column workbench may coexist, but the primary Action or review remains readable without page-level horizontal scrolling. At 390x844, navigation collapses, cards stack in semantic order, code/diff regions scroll internally and every essential control remains reachable.

Controls are at least 40 px high on narrow screens. Focus is visible, tab order follows reading order, headings are hierarchical and live updates do not steal focus. Drag interaction always has keyboard controls. `prefers-reduced-motion` removes non-essential transitions.

## Component rules

- Status badges use factual DTO values and a label, never inferred prose.
- Cards have one primary purpose and expose stable entity IDs in Geist.
- Reordering previews the resulting integer order/priority before mutation.
- Disabled approval includes the exact blocking reason. Confirmation repeats hashes and current revision.
- Diff panes keep additions, deletions and unchanged context distinguishable without color alone.
- Empty, loading, stale and error states preserve the workspace hierarchy.

## Implementation boundary

Use existing React, Vite, Tailwind and shadcn primitives. Tokens in this frontmatter are the source of truth. Intentional changes to palette, type, rhythm, radii or component language require this file and architecture evidence to change together.
