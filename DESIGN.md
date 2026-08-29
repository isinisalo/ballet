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

Inter owns prose and hierarchy; Geist owns IDs, hashes, statuses and compact metadata. The spacing rhythm is 4 px and panels use restrained radii and one-pixel boundaries. Freeform topology canvases, ad hoc palettes and reward/policy matrices are forbidden. Loop Engineering is the bounded exception for token-derived radial planet shading and station artwork: geometry is deterministic, ordered and navigational rather than ornamental or user-positioned.

## Information architecture

- **Goals** and **ADRs** are separate Markdown workspaces; Constraints, Use Cases and Instructions use the same direct Markdown editor/preview contract.
- **Authoring collections** expose Agents, Skills, Goals, ADRs, Constraints, Use Cases and Instructions as compact URL-owned nested sidebar lists; the content area is reserved for the selected editor.
- **Use Cases** keeps its compact sidebar list and makes approval status, semantic hash and Given/When/Then evidence explicit without a parallel form-owned truth.
- **Loop Engineering** keeps one ordered space canvas visible across Environment, State and Action routes. States run top-to-bottom by `order`; selecting a State reveals only its Actions left-to-right by `priority` on the same canvas.
- **State** selection is URL-owned and presents Actions as derived sun/planet/station artwork with stable text IDs. Artwork is order language, never runtime status.
- **Action flow** is a dark industrial workflow: START -> Validation -> done?, with delegate/retry through subordinate Work, evidence returning to Validation, and explicit done/blocked-Feedback terminals plus `1 + maxRetries` text.
- **Run Gate** explains why a State or Action can or cannot advance without inventing client-owned control state.
- **Feedback Box** asks a human only for Category and comment; trusted runtime provenance stays visible but is not editable.
- **Critic review** separates a read-only proposal from the human decision that may create Feedback.
- **Refinement review** shows exact paths, operations, preimage/result hashes, diff and impact before approval.
- **Run Evidence** projects the terminal commit, changed files, artifacts, validation evidence and continuation lineage inside Run detail. Product is reserved for a build deployed to dev and is not an entity in this interface.

Each workspace has one canonical URL owner. `/` is a shell landing redirect to `/automation/loops`, not a second workspace.

| Workspace | Canonical route |
| --- | --- |
| Loop Engineering | `/automation/loops` with URL-owned Environment/State/Action selection |
| Agents / Skills / Runtimes | `/agents`, `/skills`, `/runtimes` |
| Goals / ADRs / Constraints | `/project/goals`, `/project/adrs`, `/project/constraints`, each with `?id=` |
| Use Cases / Instructions | `/project/use-cases`, `/project/instructions`, each with `?id=` |
| Run Gate | `/run`, `/run/:runId`, nested State and Action routes |
| Feedback Box | `/feedback`, `/feedback/:id` |
| Critic / Refinement review | `/reviews/critic`, `/reviews/critic/:id`, `/reviews/refinement`, `/reviews/refinement/:id` |
| Run Evidence | inline in `/run/:runId` |

Back/forward restores the same selected entity. An invalid or malformed ID renders a labelled recovery state with a route back to the parent workspace; it never silently renders an empty detail.

## Layout contracts

At 1440x900, a persistent compact sidebar and multi-column workbench may coexist, but the primary Action or review remains readable without page-level horizontal scrolling. Loop Engineering uses a balanced canvas/editor split. At 390x844, navigation collapses, the canvas precedes the stacked editor, and wide canvas/workflow stages scroll inside their labelled regions while the page itself remains viewport-wide.

Controls are at least 40 px high on narrow screens. Focus is visible, tab order follows reading order, headings are hierarchical and live updates do not steal focus. Drag interaction always has keyboard controls. `prefers-reduced-motion` removes non-essential transitions.

Configure workspaces have exactly one sticky toolbar directly below the workspace heading. Status and the current entity are on the leading side; navigation, creation, ordering, projection, save, approval and deletion commands form one trailing action row. At narrow widths the toolbar scrolls internally instead of wrapping commands onto unrelated vertical levels.

## Component rules

- Markdown-backed project documents use one shared workbench: sidebar selection, YAML-frontmatter + Markdown body editor, preview and an explicit unsaved-change guard. Forms may display derived validation facts but never become a second document truth.
- Configure metadata and execution forms use compact aligned label/control rows at workbench widths and stack them at the narrow viewport. Markdown source areas remain vertically labelled editors.
- Agent detail follows the compact 15.7 profile composition: a narrow Avatar/Execution/Details rail beside Markdown Preview and the source editor. Computer, provider, model and reasoning are explicit labelled controls; unavailable/auth-missing/dirty states include text explanations and block Save or Run as appropriate.
- Status badges use factual DTO values and a label, never inferred prose.
- Cards have one primary purpose and expose stable entity IDs in Geist.
- Reordering previews the resulting integer order/priority before mutation.
- Disabled approval includes the exact blocking reason. Confirmation repeats hashes and current revision.
- Diff panes keep additions, deletions and unchanged context distinguishable without color alone.
- Empty, loading, stale and error states preserve the workspace hierarchy.
- Loop Engineering and Action flow grids cover the complete internal scroll surface. Pure geometry uses the measured surface dimensions to distribute ordered nodes across available space while retaining deterministic minimum dimensions and narrow-screen internal scrolling.

## Action flow and status language

Validation is visually primary and labelled `main/controller`; Work is connected as `subordinate`. START enters Validation, Work returns evidence to the same controller, and retry returns only to Work. The authoring projection exposes done, delegate/retry and blocked/Feedback branches without acting as a runtime control. The UI displays `1 + maxRetries` total attempts and distinguishes an operational provider failure from a semantic Validation retry.

Mint means validated or safe, amber means attention/retry, red means blocked/failure and blue means selection/primary action. Each appears with explicit text and, where useful, an icon. Runtime status is read from the API. Client components never synthesize `done`, `blocked`, percent complete, ETA or a next target.

## Approval and stale-state contract

Use Case, Critic and Refinement approval are separate deliberate dialogs. The dialog repeats the exact entity, current revision, semantic/proposal hash and consequence. Critic approval explains that one Feedback entry will be appended. Refinement approval shows exact unified diff, paths, preimage/result hashes, shared Skill impact and continuation consequence; code and diff panes scroll internally.

An unsaved draft cannot be approved. HTTP 409 conflicts preserve the local draft, show the current server revision/hash and offer explicit reload or discard. A proposal cannot be force-applied, Feedback cannot be manually resolved before verified continuation evidence, and no UI control marks an Action done.

## Responsive and accessibility acceptance

The full Goals, ADRs, Use Case, Loop Engineering, Agent binding, Runtime, Run retry, blocked Feedback, Critic approval, Refinement diff and Run Evidence matrix is reviewed at 1440×900 and 390×844. At narrow width, sidebar and portalled dialog/sheet controls meet the 40 px minimum, route selection closes mobile navigation, dialogs stay within the viewport and exact diffs scroll inside their region. Page-level `overflow-x-hidden` must not conceal clipped core content: QA measures both scroll width and element bounds.

Route changes move focus to the new workspace heading or announce it without stealing focus during factual SSE refresh. Current navigation uses `aria-current`; all form fields, switches and status cues have accessible names; keyboard order follows visual reading order; reduced motion removes non-essential movement.

## Implementation boundary

Use existing React, Vite, Tailwind and shadcn primitives. Tokens in this frontmatter are the source of truth. Pure TypeScript owns deterministic Loop Engineering geometry, ordering, edges, dimensions and derived artwork; React only renders it and forwards canonical navigation. Intentional changes to palette, type, rhythm, radii or component language require this file and architecture evidence to change together.
