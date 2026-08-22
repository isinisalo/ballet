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

Ballet is a local orchestration command center for project documents, ExecutionProfiles, instructions, skills, runtimes, Graphs, GraphNodes, aggregate JobNodes, Work and Validation roles, scoped Orchestrators and Repair Nodes, and Runs. The interface is dense, structured, technical, and calm under pressure.

The visual system combines Modern Minimalism with Technical Industrialism. Dark tonal layers support long sessions; high-vibrancy signals identify current role, validation result, repair attention and blocking failure. UI decoration never creates runtime state.

## Implementation Status Boundary

The active baseline is strict project config v14, Graph Node Module v4, Root Snapshot v7, Task Envelope and role outcome v7, composition v8, ExecutionSpec v9 and SQLite v10. There are no legacy readers, route aliases, dual writes, schedule UI or standalone JobNode Run.

Authoring has exactly three canonical URL-owned levels:

- `/automation/graph` — Graph Engineering.
- `/automation/graph/nodes/:graphNodeId` — Graph Node.
- `/automation/graph/nodes/:graphNodeId/jobs/:jobNodeId` — Job Node.

Run has Graph and GraphNode routes only. URL state owns the active level and IDs. Inspector selection remains ephemeral and never mutates topology.

## Colors

The palette is dark-only. Do not expose light/system theme until this document contains a complete first-class light palette.

- **Primary / Electric Blue:** primary commands, selected navigation and focused fields.
- **Secondary / Emerald:** running Work/Validation, PASS, healthy state and go-forward semantics.
- **Canvas Flow / Mint:** all thin candidate spokelines and the fixed Work→Validation link. Always pair connection semantics with exact icon/text where a connection is rendered.
- **Tertiary / Amber:** IDs, warnings, queued/human-wait states, retry and repair attention.
- **Error:** FAIL, blocked/failed Runs, invalid config and destructive actions only.
- **Surfaces:** application `#0c0e11`, primary panels `#111316`, sidebar/compact headers `#1a1c1f`, elevated interactive surfaces `#1e2023`/`#282a2d`, subtle borders `#414755`.

The project canvas theme may configure existing artwork colors, sizes and glows. It must not introduce a second application palette or new shape language.

## Typography

Use Inter for interface text and Geist for identifiers, target enums, paths, timestamps, JSON/frontmatter and terminal data.

- `headline-lg` is reserved for main workspaces; Engineering headers use compact `headline-sm` where density matters.
- `body-md` is default application copy.
- `label-caps` identifies metadata and status groups.
- `code-md` displays exact technical values and definitions.
- Canvas IDs remain readable at the minimum zoom; layout must not shrink label text below its configured minimum.

## Layout & Spacing

- Desktop uses a 12-column fluid grid and a sidebar near 280px. Primary canvas space stays fluid.
- Use the 4px spacing unit, 8/16px related-control rhythm and 20px primary-panel padding.
- Compact desktop controls are 28px; default controls 32px; narrow controls at least 40px and form text at least 16px.
- Desktop Engineering uses a compact header, dominant canvas and 22–24rem inspector. Narrow viewports move the same inspector content into a Sheet without page-level horizontal overflow.
- Avoid empty decorative zones. Keep actions adjacent to the object or scope they affect.

## Protected Three-Level Space Canvas Contract

All three canvases use the same protected visual language: a dark 24px technical grid, code-native planet artwork, configured independent sizes/styles, restrained reasoning glow, amber exact-ID labels, thin 1.5px mint connections and static semantic highlights under `prefers-reduced-motion`. PASS/FAIL result endpoints are not rendered on these canvases.

### Graph Engineering

- Center one globally scoped Luna Orchestrator artwork.
- Show the optional Sol Repair Node visibly connected to the Orchestrator.
- Arrange only GraphNode planets around the hub.
- Do not render PASS/FAIL labels, connection points or endpoint spokes.
- Spokes represent membership in authored start/continuation/repair candidate rules. They are not child-to-child Edges or runtime outcomes.
- Activating a GraphNode navigates directly to its Graph Node route. Selecting Orchestrator or Repair opens the inspector.

### Graph Node

- Center the selected GraphNode's Luna Orchestrator and show its optional Sol Repair Node.
- Arrange only that GraphNode's JobNode planets around the hub; render zero peer/foreign GraphNodes or foreign Jobs.
- Do not render PASS/FAIL labels, connection points or endpoint spokes; retain candidate membership spokes.
- Activating a JobNode navigates directly to its Job Node route.

### Job Node

- Render separate Work and Validation planets with their own configured artwork.
- Draw Work→Validation as a fixed mint validate link.
- Draw Validation FAIL retry→Work as a fixed amber retry route and label its bounded retry semantics.
- Do not render PASS/FAIL terminal labels, points or endpoint spokes.
- Work and Validation selection open their settings/instructions. Job aggregate settings open from a compact header command.

## Canvas Layout & Interaction

- Use deterministic radial multi-ring placement. Preserve stable ordering, minimum separation, pan/zoom and minimum text size for 1/5/40 GraphNodes and 1/17/64 JobNodes.
- Acceptance is zero node overlap, zero page-level horizontal overflow and zero clipped core action at 1440×900 and 390×844.
- Canvas objects are keyboard focusable with exact accessible names. Space selects and Enter drills down when the object has a child route.
- Breadcrumbs navigate to the parent and Graph Engineering. Browser back/forward must reproduce URL-owned scope.
- Do not add decorative edge types, freeform topology, Bézier routes, hybrid level controls or foreign-scope summaries to a canvas.
- Active Run locks authoring mutations but keeps inspection and navigation available.

## Inspectors & Authoring

- Orchestrator inspector exposes identity, scope, explicit ExecutionProfile, primary instruction, skills, limits and authored start/continuation/repair candidate rules.
- Repair inspector exposes explicit ExecutionProfile, instruction, skills, attempt/depth limits and bounded outcomes. It never presents expanded permission or active-snapshot mutation controls.
- Work inspector exposes agent/human type, task, appearance, explicit profile/instruction/skills and capability/State contract.
- Validation inspector exposes criteria, appearance, explicit composition and PASS/FAIL contract. FAIL repair input contains no target ID.
- Job aggregate inspector exposes identity, appearance, capability and `maxRetries` without duplicating child composition.
- Blank authoring/import requires an explicit profile and instruction mapping. Never choose the first profile or instruction silently.
- Work, Validation and Repair instructions must not name sibling node IDs. Only same-level Orchestrator instructions and candidate rules know routing targets.

## Graph Node Modules

Graph Node Module v4 UI supports inspect, plan, install, export and remove for exactly one GraphNode plus its aggregate Jobs, scoped Orchestrator, optional Repair and resource closure. Show package hash, provenance, conflicts and explicit profile/instruction mapping. Peer-GraphNode-targets are project-global and must not appear as package-owned routes.

## Run Control Surface

Lead with a compact canonical-position strip for root kind, GraphNode, JobNode, role, profile, attempt, State revision, repair depth, return destination and terminal status. Follow with a scope-correct snapshot and one persistent live inspector. Derive all values from immutable snapshot and canonical persistence; never invent progress, elapsed time, ETA, dialogue, State, target or return path from provider prose.

Human Work returns a Work outcome. Human Validation returns `PASS | FAIL`; FAIL carries evidence and target-ID-free repair input. Orchestrator awaiting input exposes only the valid resume/decision boundary.

## Other Workspaces

- **ExecutionProfiles:** compact provider/model/reasoning/network controls; no implicit fallback.
- **Project Instructions:** responsive Markdown preview/edit with exact `project:<id>`, path, validation state and explicit Save.
- **Project Skills:** list `.agents/skills/**/SKILL.md` with project ID, path and validation state; invalid paths remain visible blocking errors.
- **Canvas Theme:** one `/automation/theme` workspace using only the fixed artwork/connection token language. Theme identity, cloning, assignment and per-size renderers are outside the current boundary.
- **Global Ballet Mode:** one text-first Ballet menu for Run and Configure. Configure contains documents, instructions, skills, profiles, theme and Graph Engineering; Run contains Overview, active Graph Runs and GraphNode Runs.

## Do's and Don'ts

- Do use these tokens for color, spacing, radius and typography.
- Do prefer dense, scannable, work-focused surfaces.
- Do use exact entity IDs, scope, status, target enum and timestamps.
- Do distinguish Luna Orchestrator and Sol Repair through existing artwork/labels, not a new palette.
- Don't introduce one-off colors, ornamental backgrounds, decorative gradients or a new shape language.
- Don't use signal colors as passive decoration.
- Don't hide operational state behind vague labels.
- Don't combine Graph, GraphNode and JobNode scopes on one canvas.
- Don't render candidate membership as child-to-child runtime Edges.
