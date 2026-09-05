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
  story-role: '#adc6ff'
  on-story-role: '#002e69'
  story-goal: '#ffb95f'
  on-story-goal: '#472a00'
  story-benefit: '#c4b5fd'
  on-story-benefit: '#2e1f54'
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

Inter owns prose and hierarchy; Geist owns IDs, hashes, statuses and compact metadata. The spacing rhythm is 4 px and panels use restrained radii and one-pixel boundaries. Freeform topology canvases, ad hoc palettes, ornamental planet/radial artwork and reward/policy matrices are forbidden. Loop Engineering is a deterministic navigational tree rather than a user-positioned topology editor.

## Information architecture

- **Goals** and **ADRs** are separate Markdown workspaces; Constraints, Use Cases and Instructions use the same direct Markdown editor/preview contract.
- **Authoring collections** expose Agents, Skills, Goals, ADRs, Constraints, Use Cases and Instructions as compact URL-owned nested sidebar lists; the content area is reserved for the selected editor.
- **Use Cases** keeps its compact sidebar list and makes approval status, semantic hash and Given/When/Then evidence explicit without a parallel form-owned truth.
- **User Story** is a repository-first collection before Use Cases in the Project menu. Its main content is a list of complete story cards, including every acceptance criterion. Creation and editing use the same structured card editor over the canonical Markdown file; they do not use a second Markdown workbench or config-owned copy.
- **Loop Engineering** keeps one ordered authoring tree visible across Environment, State, Action and Action Agent routes. Its three left-to-right ranks are STATE -> ACTION -> AGENTS. States run top-to-bottom by `order`; selecting a State reveals only its Actions top-to-bottom by `priority`; selecting an Action reveals its Validation and Work Agent nodes.
- **Selection and creation** are URL-owned. Canvas nodes and left-sidebar Action rows show only a concise readable name; exact IDs and the full canonical Action name remain in URLs, accessible names and settings. An Action omits an exact repeated `State name - ` prefix in both navigation surfaces. The final State node is `+ STATE`; the selected State's final Action node is `+ ACTION`. These nodes open creation forms in the settings pane and successful creation navigates to the new entity.
- **Validation-led execution** remains server-owned runtime behavior and is not duplicated as a separate authoring flow. State and Action editors have no Use Case fields. Project direction is read only when the selected instruction or Skill explicitly requires the relevant canonical `.ballet/**` documents.
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
| User Story | `/project/user-stories`, `?create=story` or `?id=<uuid>` |
| Run Gate | `/run`, `/run/:runId`, nested State and Action routes |
| Feedback Box | `/feedback`, `/feedback/:id` |
| Critic / Refinement review | `/reviews/critic`, `/reviews/critic/:id`, `/reviews/refinement`, `/reviews/refinement/:id` |
| Run Evidence | inline in `/run/:runId` |

Back/forward restores the same selected entity. An invalid or malformed ID renders a labelled recovery state with a route back to the parent workspace; it never silently renders an empty detail.

## Layout contracts

At 1440x900, a persistent compact sidebar and multi-column workbench may coexist, but the primary Action or review remains readable without page-level horizontal scrolling. Loop Engineering uses a balanced canvas/editor split. At 390x844, navigation collapses, the pannable/zoomable canvas precedes the stacked editor and the page itself remains viewport-wide.

Controls are at least 40 px high on narrow screens. Focus is visible, tab order follows reading order, headings are hierarchical and live updates do not steal focus. Drag interaction always has keyboard controls. `prefers-reduced-motion` removes non-essential transitions.

Dense information use is a product requirement. Short IDs, bounded numbers, enums and their helper text use intrinsic or narrow maximum widths instead of stretching across the workbench. Related label, control and explanation stay on one compact row when the viewport permits. Panels, forms and lists use the smallest tokenized padding and gap that preserve legibility; large empty control surfaces that push primary work below the viewport are defects.

Configure workspaces have exactly one sticky toolbar directly below the workspace heading. Status and the current entity are on the leading side; navigation, ordering, save, approval and deletion commands form one trailing action row. At narrow widths the toolbar scrolls internally instead of wrapping commands onto unrelated vertical levels. The canvas `+ STATE` and `+ ACTION` nodes switch the right pane to the corresponding creation form. Action Workspace is the bounded exception: it keeps only a screen-reader heading, has no visible workspace heading or toolbar, and places its atomic save/status row at the end of the form. Action deletion belongs to the owning State's sortable Action row.

The workspace shell renders no desktop event-status header; SSE remains a background invalidation mechanism. Narrow layouts retain a compact, at least 40 px mobile navigation trigger before workspace content.

## Component rules

- Markdown-backed project documents use one shared workbench: sidebar selection, YAML-frontmatter + Markdown body editor, preview and an explicit unsaved-change guard. Forms may display derived validation facts but never become a second document truth.
- Configure metadata and execution forms use compact aligned label/control rows at workbench widths and stack them at the narrow viewport. Markdown source areas remain vertically labelled editors.
- Agent detail is a three-column fixed-role workbench at 1440×900: profile/settings (fixed Codex provider, model, reasoning and Skills), one large Developer instructions Markdown editor without Preview, and a role-specific purpose/workflow/safety guide. The only toolbar mutation is `Save Agent`; create/delete/execution commands do not exist. Authoring exposes only `gpt-5.6-sol`, `gpt-5.6-terra` and `gpt-5.6-luna` in that order. A TOML that names another model remains unchanged, shows an exact blocking warning and cannot be saved until a supported model is selected. Missing or invalid TOML remains navigable and names its exact Git restoration path. At 390×844 the columns stack in that reading order with no page-level horizontal overflow.
- Action Workspace has three URL-owned subviews: Action settings, Validation Agent settings and Work Agent settings. An Agent view exposes its fixed derived ID as read-only Name plus editable Description, developer instructions, model, reasoning and Skills. Model uses the standard select; reasoning uses a labelled native discrete range control with explicit value and keyboard/touch semantics. Selected Skills use removable shadcn badges with a ghost `+ Skill` chooser. Both Agent drafts remain mounted in the shared Action state while subviews change. `Save Action` persists Project Config and both Action-agent TOMLs atomically with optimistic hashes from the form-end save row and is disabled during an active Run. Positive readiness prose is omitted; blocking issues remain explicit beside the disabled save. There is no instruction dropdown, planet artwork or machine-local execution editor. Provider, sandbox, network, read-only-root, Computer and pairing controls do not exist.
- Runtimes is a singleton checkout-local diagnostic: daemon status/PID/uptime/last seen/error, active tasks, Codex readiness and keyboard-operable Refresh, Restart and Logs. Restart is visibly disabled during active work.
- Status badges use factual DTO values and a label, never inferred prose.
- Cards have one primary purpose and expose stable entity IDs in Geist.
- State order and Action priority are edited only through compact ID-only sortable lists. Pointer drag or keyboard movement persists immediately through the canonical reorder endpoint; no checkbox, integer editor or Earlier/Later command duplicates ordering authority. An Action's confirmed delete command is colocated with its owning State's sortable Action row and is disabled while authoring is locked.
- Disabled approval includes the exact blocking reason. Confirmation repeats hashes and current revision.
- Diff panes keep additions, deletions and unchanged context distinguishable without color alone.
- Empty, loading, stale and error states preserve the workspace hierarchy.
- Loop Engineering's React Flow surface covers the complete labelled canvas. Dagre assigns left-to-right ranks and pure TypeScript normalizes the top-to-bottom canonical order within STATE, ACTION and AGENTS columns. Token-derived rounded rectangles use a rank gap near one node width, generous row gaps and concise visible names; the selected State is centered against its Action group and the Agent pair against the selected Action. Selected nodes and edges use full opacity; every unselected node and order/branch edge uses 25% opacity. State -> Action branches remain present after Action selection. Every cross-rank connection point is aligned to the exact center of the source right side or target left side, but its circle sits 8 px outside the node. The 1.5 px Bézier path starts and ends at those detached circle centers, leaving a gap between circle and node. Edges avoid multi-turn routing; visual lightness comes from geometry and opacity hierarchy rather than a hairline stroke. The graph is read-only but supports pointer/keyboard node activation, pan and explicit zoom controls; nodes cannot be dragged or connected. The React Flow attribution badge is hidden. Layout growth never causes page-level horizontal overflow, and narrow controls remain at least 40 px high.

## User Story visual contract

Role uses `story-role` / `on-story-role`, Goal uses `story-goal` / `on-story-goal`, and Benefit uses `story-benefit` / `on-story-benefit`. These pairs describe sentence structure only; operational statuses retain their existing semantics. All three pairs exceed 7:1 text contrast. The list and editor both display a wrapping Role / Goal / Benefit legend with labelled rectangular swatches.

The list uses one full-width card per story, 20 px internal padding and 16 px between cards. A compact Geist identifier and Edit command precede the 18 px / 32 px Inter story sentence. Neutral “As a”, “I want” and “so that” connectors surround colored inline highlights, which wrap with their content. Highlight corners use the existing small radius. The story color pairs also fill the three growing, visibly labelled editor textareas. No content is truncated.

Every story shows Acceptance criteria and its count below a separator. Numbered criteria always show GIVEN, WHEN and THEN as three vertical rows, using neutral keyword surfaces and prose. Zero criteria is valid and visibly labelled. At 390×844, keyword labels precede their text, story fields stack, the legend wraps and controls remain at least 44 px high. Desktop content padding is 24 px; narrow padding is 16 px. The toolbar remains a single sticky action row.

The card editor saves all three required story parts and zero to fifty complete criteria together. Save returns to the list and focuses the saved card. An explicit delete dialog names the story and explains removal of its criteria. Unsaved edits use the shared navigation guard. File conflicts retain the local draft and expose the latest hash and explicit reload; invalid or missing files remain recoverable without silently overwriting them. User Story content has no approval or runtime status. All persisted content is owned by `.ballet/user-stories/<uuid>.md`.

## Runtime status language

Validation remains the controller and Work remains subordinate in runtime semantics. The authoring canvas names both roles but does not project START, done, delegate, retry or blocked branches. Action settings display `1 + maxRetries` total attempts, and Run surfaces distinguish an operational provider failure from a semantic Validation retry.

Mint means validated or safe, amber means attention/retry, red means blocked/failure and blue means selection/primary action. Each appears with explicit text and, where useful, an icon. Runtime status is read from the API. Client components never synthesize `done`, `blocked`, percent complete, ETA or a next target.

## Approval and stale-state contract

Use Case, Critic and Refinement approval are separate deliberate dialogs. The dialog repeats the exact entity, current revision, semantic/proposal hash and consequence. Critic approval explains that one Feedback entry will be appended. Refinement approval shows exact unified diff, paths, preimage/result hashes, shared Skill impact and continuation consequence; code and diff panes scroll internally.

An unsaved draft cannot be approved. HTTP 409 conflicts preserve the local draft, show the current server revision/hash and offer explicit reload or discard. A proposal cannot be force-applied, Feedback cannot be manually resolved before verified continuation evidence, and no UI control marks an Action done.

## Responsive and accessibility acceptance

The full Goals, ADRs, Use Case, Loop Engineering, Action-agent authoring, Runtime, Run retry, blocked Feedback, Critic approval, Refinement diff and Run Evidence matrix is reviewed at 1440×900 and 390×844. At narrow width, sidebar and portalled dialog/sheet controls meet the 40 px minimum, route selection closes mobile navigation, dialogs stay within the viewport and exact diffs scroll inside their region. Page-level `overflow-x-hidden` must not conceal clipped core content: QA measures both scroll width and element bounds.

Route changes move focus to the new workspace heading or announce it without stealing focus during factual SSE refresh. Current navigation uses `aria-current`; all form fields, switches and status cues have accessible names; keyboard order follows visual reading order; reduced motion removes non-essential movement.

## Implementation boundary

Use existing React, Vite, Tailwind and shadcn primitives plus React Flow and Dagre for Loop Engineering. Tokens in this frontmatter are the source of truth. Pure TypeScript owns deterministic ordering, Dagre input/output normalization, edges and dimensions; React renders the read-only graph and forwards canonical navigation. Intentional changes to palette, type, rhythm, radii or component language require this file and architecture evidence to change together.
