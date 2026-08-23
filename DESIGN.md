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
  canvas-flow: '#76d4ca'
  space-void: '#08090b'
  luna-surface: '#87cdbc'
  luna-highlight: '#b9eee1'
  luna-shadow: '#214b47'
  sol-surface: '#f5a63a'
  sol-highlight: '#ffd795'
  sol-shadow: '#71370b'
  terra-surface: '#4e9b8b'
  terra-highlight: '#9ae3d3'
  terra-shadow: '#183a48'
  flat-surface: '#72798b'
  flat-highlight: '#b8c0d4'
  flat-shadow: '#292d37'
  vector-planet-surface: '#6a86c6'
  vector-planet-highlight: '#b2c7fb'
  vector-planet-shadow: '#273359'
  mars-surface: '#b85f4c'
  mars-highlight: '#e19a78'
  mars-shadow: '#572a25'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
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
  inspector-title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
  inspector-body:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  inspector-value:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  inspector-label:
    fontFamily: Geist
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
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
  compact-label-column: 88px
---

## Brand & Style

Ballet is a local orchestration command center for project documents, ExecutionProfiles, instructions, skills, runtimes, Graphs, GraphNodes, aggregate Action Nodes, Work and Validation roles, a Graph-level Reward-MDP, and Runs. The interface is dense, structured, technical, and calm under pressure.

The visual system combines Modern Minimalism with Technical Industrialism. Dark tonal layers support long sessions; high-vibrancy signals identify current role, validation result, retry attention and blocking failure. UI decoration never creates runtime state.

## Implementation Status Boundary

The active implementation baseline is strict project config v18, Decision Model v3, Graph Node Module v6, Root Snapshot v11, policy observation v4, Task Envelope and role outcome v9, composition v10, ExecutionSpec v11 and SQLite v14. One Graph-level `reward_mdp_v3` policy is compiled once into the immutable snapshot. The execution inspector presents exact reward breakdown, discount, PPM branches, prior provenance, acceptance progress and read-only Q/V evidence. There are no local Decision Models, scoped Orchestrators, Repair Nodes, legacy readers, route aliases, dual writes, schedule UI or standalone Action Node Run.

Authoring has exactly three canonical URL-owned levels:

- `/automation/graph?section=capabilities|decision-model` — Graph Engineering.
- `/automation/graph/nodes/:graphNodeId?section=actions` — Graph Node.
- `/automation/graph/nodes/:graphNodeId/actions/:actionNodeId` — Action Node.

Run has Graph and GraphNode routes only. URL state owns the active level and IDs. Inspector selection remains ephemeral and never mutates topology.

## MDP Terminology

- `Action` is the MDP choice `a ∈ A(s)`: an option available to the orchestrator in the current decision state. Policy, Q/V and guard surfaces use this term directly.
- `Action Node` is the strict-v18 aggregate `ProjectActionNode`. It owns one Work and one Validation role plus bounded retry; it is the executable projection of a selected action.
- `actionNodes`, `actionNodeId` and `action_node_invocations` are the only active schema, API and persistence identifiers. No `JobNode` alias or compatibility path exists.

## Colors

The palette is dark-only. Do not expose light/system theme until this document contains a complete first-class light palette.

- **Primary / Electric Blue:** primary commands, selected navigation and focused fields.
- **Secondary / Emerald:** running Work/Validation, PASS, healthy state and go-forward semantics.
- **Canvas Flow / Mint:** the fixed Action flow and retry-return connections. Always pair connection semantics with exact icon/text where a connection is rendered.
- **Tertiary / Amber:** IDs, warnings, queued/human-wait states and retry attention.
- **Error:** FAIL, blocked/failed Runs, invalid config and destructive actions only.
- **Surfaces:** application `#0c0e11`, primary panels `#111316`, sidebar/compact headers `#1a1c1f`, elevated interactive surfaces `#1e2023`/`#282a2d`, subtle borders `#414755`.

The project canvas theme may configure existing Work/Validation artwork colors, sizes and glows. It must not introduce a second application palette or new shape language.

## Typography

Use Inter for interface text and Geist for identifiers, target enums, paths, timestamps, JSON/frontmatter and terminal data.

- `headline-lg` is reserved for main workspaces; Engineering headers use compact `headline-sm` where density matters.
- `body-md` is default application copy.
- `label-caps` identifies metadata and status groups.
- `code-md` displays exact technical values and definitions.
- Exact IDs remain readable in cards and the Action flow; long values truncate visually only when their full value remains available through accessible text or a title.

## Layout & Spacing

- Desktop uses a 12-column fluid grid and a sidebar near 280px. Primary canvas space stays fluid.
- Use the 4px spacing unit, 8/16px related-control rhythm and 20px primary-panel padding.
- Compact desktop controls are 28px; default controls 32px; narrow controls at least 40px and form text at least 16px.
- Graph and GraphNode Engineering use a compact header, URL-owned section tabs and responsive card/panel grids. Action Node uses a dominant flow canvas plus a 22–24rem inspector; narrow viewports move the same inspector content into a Sheet without page-level horizontal overflow.
- Avoid empty decorative zones. Keep actions adjacent to the object or scope they affect.

## Capability-first Engineering and Protected Action Node Flow

Graph Engineering and Graph Node use the same compact cyber-industrial card language as Execution Profiles and Skills: tonal panels, thin tokenized borders, exact mono IDs, concise status badges and adjacent actions. Cards are authoring projections and never create runtime state. Only Action Node uses the dark 24px technical grid and ADR-025 as refined by ADR-027's protected industrial flow language.

### Graph Engineering

- `Capability Graph` shows responsive GraphNode cards with exact ID, description, accepts/provides, intrinsic outcome contracts, readiness and adjacent open/edit/rename/delete actions.
- `Decision Model` is the Graph-level Reward-MDP visual impact dashboard. Lead with `Decision pulse`: draft-projected state, factual acceptance classification, selected GraphNode option, human-scale `V(s)` and visible prior provenance. Explicitly label the projection as authoring preview rather than live Run state.
- `Policy horizon` preserves project-config GraphNode order for 1–20 options, highlights the compiled selection and distinguishes state-admissible, elsewhere-modeled and `needs transition model` options. It may scroll only inside its panel and must state that option order is not persisted runtime flow.
- `Transition impact` projects the selected `(state, action)` branches without a traditional table. Probability controls a bounded bar/width cue; positive immediate reward uses Secondary plus `+`/`reward`, negative impact uses Error plus `−`/`cost`, and zero uses Tertiary plus `neutral`. Outcome, next-state and provenance text remain exact. Color is never the only signal.
- `Policy landscape` renders the bounded compiled state catalog as a selectable relative-`V(s)` heatmap. Tile selection is ephemeral inspection only and reveals exact acceptance status plus Q-values without mutating topology, draft or runtime. Distinguish selected inspection state from the current projected state.
- Primary reward values use `micros / 1,000,000` reward units and probabilities use `ppm / 10,000` percentages. Preserve exact integer micros/ppm in accessible title/detail, API, project config and immutable snapshot. Relative heatmap color must be labeled relative; it does not assert positive absolute reward.
- Reward authoring uses compact ±1 reward-unit steppers and a neutral→amber→error penalty spectrum instead of raw-number fields. Active Run locking remains visible and disables every mutation.
- Do not place traditional form layouts, transition tables or Q/V tables on the primary Decision Model surface. Bounded action, state and Q collections scroll inside their own panels; the page itself never overflows horizontally.
- State/catalog, action guards, absorption status and deterministic solver bounds remain inspectable without becoming runtime control state.
- `default_prior` branches are visibly distinguished from `authored_evidence`; the UI never presents the default as calibrated evidence.
- A draft may be saved; Run readiness is a separate visible state.

### Graph Node

- `Actions` shows only the selected GraphNode's Action Node cards with intrinsic outcomes, capability contracts, readiness and full CRUD.
- GraphNode has no local policy, local solver, orchestrator or Repair surface. Its Action Nodes execute in configured array order.
- Action Node rename and deletion update only owned structural references; there are no local policy references to maintain.
- Upper-level appearance, artwork and multi-ring data do not belong to GraphNode or Action Node aggregate contracts.

### Action Node

- Render one deterministic authoring flow: `Start → Work ID → Validation ID → Pass?`, with `Pass?` and `Retry?` on the same level, `Pass?` branching to `Continue` or `Retry?`, and `Retry?` branching back to Work or down to `Escalate`.
- Project Work and Validation as the only interactive cards. Show only each exact node ID in the visible card; keep Work/Validation role context in the accessible name. Preserve configured artwork as a compact emblem and configured size as the card width.
- Show structurally incomplete Work/Validation definitions as dashed ghost cards that remain selectable for completion.
- `Pass?` and `Retry?` show only their question text and share a horizontal level. A dashed, non-interactive `Retry count X` ghost marker floats to the left of `Retry?`, where `X` is the configured Action Node `maxRetries` value shown in Action Node settings; it does not represent persisted runtime state.
- Normal flow and the enabled `Yes` retry return use the 1.5px mint flow token; the retry return remains dashed and exhausted FAIL is Error semantic. Escalate returns a typed semantic outcome to the Graph Reward-MDP and is not rendered as a button.
- Show Start, Continue and Escalate as fixed non-interactive circular semantic markers; Continue and Escalate share a horizontal level. Continue advances to the next ordered Action Node; Escalate terminates the GraphNode option with its typed FAIL outcome.
- Route the dashed retry edge directly from Retry? to Work, outside the Retry count ghost marker.
- `maxRetries = 0` omits the active retry-return link. No Human gate, freeform edge authoring or runtime action belongs to this canvas.
- Work and Validation selection open their settings/instructions. Action Node aggregate settings open from the compact header command; narrow viewports use the same inspector content in a Sheet.

## Layout & Interaction

- Use a responsive, stable-order card grid for 1/5/40 GraphNodes and 1/17/64 Action Nodes. Use deterministic wide/narrow static placement only for Action flow.
- Acceptance is zero card overlap, zero page-level horizontal overflow and zero clipped core action at 1440×900 and 390×844.
- Card actions and Action flow Work/Validation are keyboard focusable with exact accessible names. Action flow's fixed semantic markers are not focus targets.
- Breadcrumbs navigate to the parent and Graph Engineering. Browser back/forward must reproduce URL-owned scope.
- Do not add decorative graph geometry, freeform topology, Bézier routes or hybrid level controls. Action flow does not render a parent-scope reference or a Next action target; ordered execution and Graph policy remain runtime-owned.
- Active Run locks authoring mutations but keeps inspection and navigation available.

## Inspectors & Authoring

- Graph Reward-MDP authoring is inline only in Graph Engineering. GraphNode exposes ordered Action Nodes and no local strategy editor.
- Authorization, acceptance-ledger and compiled policy are immutable runtime evidence; inspectors never edit an active snapshot.
- Work inspector exposes agent/human type, task, appearance, explicit profile/instruction/skills and capability/State contract.
- Validation inspector exposes criteria, appearance, explicit composition and PASS/FAIL contract. FAIL selects `retry | escalate` and carries no routing target ID.
- Action Node aggregate settings expose identity, capability, intrinsic outcomes and `maxRetries` without aggregate appearance or duplicated child composition.
- Blank authoring/import requires an explicit profile and instruction mapping. Never choose the first profile or instruction silently.
- Work and Validation instructions must not name sibling node IDs or Graph routing targets. The Graph Reward-MDP owns GraphNode selection.

## Graph Node Modules

Graph Node Module v6 UI supports inspect, plan, install, export and remove for exactly one GraphNode plus its ordered aggregate Action Nodes, intrinsic outcomes and resource closure. It exports no local strategy, Repair, probability, reward, project-specific transition data or upper-level appearance. Show package hash, provenance, conflicts and explicit profile/instruction mapping. Peer-GraphNode targets remain project-global Reward-MDP data.

## Run Control Surface

Lead with a compact canonical-position strip, then show `Current State`, factual acceptance progress, `Current Decision` with Q/V and reward evidence, the immutable compiled policy and factual `Execution Graph`. Derive every value from snapshot and canonical persistence; never invent progress, elapsed time, ETA, dialogue, State, target or return path from provider prose.

Human Work returns a Work outcome. Human Validation returns `PASS | FAIL`; FAIL carries evidence and a `retry | escalate` disposition without a target ID. Human input surfaces expose only the valid resume/decision boundary.

## Other Workspaces

- **ExecutionProfiles:** compact provider/model/reasoning/network controls; no implicit fallback.
- **Project Instructions:** responsive Markdown preview/edit with exact `project:<id>`, path, validation state and explicit Save.
- **Project Skills:** list `.agents/skills/**/SKILL.md` with project ID, path and validation state; invalid paths remain visible blocking errors.
- **Canvas Theme:** one `/automation/theme` workspace using only the fixed Action flow artwork/connection token language. Theme identity, cloning, assignment and per-size renderers are outside the current boundary.
- **Global Ballet Mode:** one text-first Ballet menu for Run and Configure. Configure contains documents, instructions, skills, profiles, theme and Graph Engineering; Run contains Overview, active Graph Runs and GraphNode Runs.

## Do's and Don'ts

- Do use these tokens for color, spacing, radius and typography.
- Do prefer dense, scannable, work-focused surfaces.
- Do use exact entity IDs, scope, status, target enum and timestamps.
- Do distinguish readiness, prior provenance, retry/escalate and outcome semantics with exact text/status plus existing tokens, not a new palette.
- Do pair Decision Model reward/cost color with an explicit sign and `reward | cost | neutral` text.
- Don't introduce one-off colors, ornamental backgrounds, decorative gradients or shape language beyond standard cards and the protected Action Node industrial-flow contract.
- Don't use signal colors as passive decoration.
- Don't hide operational state behind vague labels.
- Don't expose raw micros or ppm as the primary Decision Model value, and don't restore dense form/table inventory as its main interaction.
- Don't combine Graph, GraphNode and Action Node authoring scopes in one section.
- Don't present configured transition predictions as factual execution or actual state.
