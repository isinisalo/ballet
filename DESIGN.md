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
  loop-flow: '#76d4ca'
  loop-connection-point: '#e3fffb'
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
controls:
  compact-height: 28px
  compact-font-size: 12px
  default-height: 32px
  default-font-size: 14px
  mobile-height: 40px
  mobile-input-font-size: 16px
  compact-label-column: 88px
---

## Brand & Style
Ballet is a local orchestration command center for managing project documents, ExecutionProfiles, instructions, skills, runtimes, Loops, Steps, Transitions, and Runs. The interface must feel like a high-stakes AI operations workspace: dense, structured, technical, and calm under pressure.

The visual system uses **Modern Minimalism** fused with **Technical Industrialism**. Dark tonal layers reduce eye strain during long monitoring sessions, while high-vibrancy signal colors mark active decisions, Step state, Transition state, and Run urgency. The target users are DevOps engineers, AI architects, and orchestration operators who need fast scanning, reliable hierarchy, and low visual ambiguity.

## Colors
The palette is rooted in a deep, multi-layered dark mode.

Theme support is currently dark-only. Do not expose light or system theme modes unless a complete light palette is added to this file and implemented as first-class design tokens.

- **Primary (Electric Blue):** Use for primary commands, selected navigation, focused fields, and selected Loop nodes.
- **Secondary (Emerald):** Use for running Steps, successful Step outcomes, accepted goals, healthy runtimes, and go-forward states.
- **Loop Flow (Mint):** Use as the global Loop theme baseline for thin normal connectors and active Transition glow, with the brighter `loop-connection-point` token for endpoint orbs. The single project theme may replace these colors and choose each edge pattern across every Loop canvas. Keep rejected and rework connectors semantically muted with a shade derived from the selected edge color.
- **Tertiary (Amber):** Use for warnings, queued Steps, human-wait states, and attention states that do not require destructive styling.
- **Error:** Use only for failed or blocked Runs, invalid Loop state, destructive commands, and blocking validation errors.
- **Background & Surfaces:** Use `#0c0e11` for the application and workspace base. Use `#111316` for primary cards and panels, and `#1a1c1f` for the sidebar, compact headers, and nested sections. Reserve `#1e2023` and `#282a2d` for popovers, selected states, hover states, and other elevated interactive surfaces. Keep borders subtle but visible with `#414755` or lower-contrast variants.

## Typography
Use **Inter** for the main interface. Use **Geist** for technical data, Step Transitions, Run inputs, CLI excerpts, file paths, identifiers, timestamps, and frontmatter previews.

- Use **headline-lg** for main workspace titles only.
- Use **headline-md** and **headline-sm** for section-level hierarchy inside project, ExecutionProfile, Loop, Step, runtime, and Run views.
- Use **body-md** as the default application text style.
- Use **label-caps** for sidebar section labels, metadata labels, status group headings, and compact table headers.
- Use **code-md** for TOML, YAML, Markdown frontmatter, JSON input, Step definitions, terminal output, and Transition targets.
- Keep technical labels concise. Prefer exact entity names, status values, and timestamps over descriptive prose.

## Layout & Spacing
The layout follows a fluid grid with sidebar-heavy navigation and dense operational workspaces.

- **Desktop:** Use a 12-column grid. Keep primary navigation sidebars fixed near 280px when expanded. Let the main workspace remain fluid and scrollable.
- **Data Density:** Keep density high but structured. Use the 4px spacing unit. Default vertical rhythm between related controls is 8px or 16px. Use 20px panel padding for primary work areas.
- **Control Density:** Use 28px controls with 12px text for compact desktop forms and 32px controls with 14px text by default. At narrow mobile widths, use 40px controls and at least 16px input text to keep forms legible and prevent viewport zoom. Compact label/value forms use an 88px label column and stack labels above controls when that column would compress the value.
- **Functional Zones:** Separate navigation, collection lists, entity detail panels, previews, Run history, and editor surfaces into clear zones with borders and tonal layers.
- **Flow Visualization:** Use the compact composite Loop canvas with independently selected node artwork and size. Every artwork supports Tiny 24px, Small 36px, Medium 48px, and Large 64px. Use fixed-scale panning, smart routed 1.5px paths, explicit Transition labels, and unobstructed return/cycle paths. Vertically center mixed-size nodes in a lane so their left/right connection points share one horizontal line and direct edges remain straight. Keep at least 208px of horizontal path clearance between full-size node columns. Apply the one tracked `.ballet/theme.json` theme to node labels, ExecutionProfile-derived reasoning glow, edges, and connection points across every Loop. Node artwork is Step appearance data selected from the fixed catalog and is not theme-configurable. Present the All Loops overview as a dense responsive card grid rather than a second editable graph.
- **Mobile:** Stack panels vertically. Convert sidebars to sheets or drawers. Keep key filters and commands reachable from a persistent top or bottom control.

## Elevation & Depth
Depth is conveyed through tonal layering first and shadows second.

- **Level 0 (Base):** Use `#0c0e11` for the application and workspace background.
- **Level 1 (Panels):** Use `#111316` for primary panels and cards with a 1px border. Use `#1a1c1f` selectively for compact headers and nested sections. Do not add decorative shadows.
- **Level 2 (Modals/Popovers):** Use `#1e2023` with a visible border, a subtle 10% white inner edge, and a restrained dark shadow.
- **Active State:** Elements currently selected, edited, monitored, or focused may receive a 4px Primary glow at 20% opacity.
- **Disabled State:** Lower opacity and reduce contrast. Do not change the shape language or introduce new colors.

## Shapes
The shape language is **Soft-Industrial**. Keep controls precise and compact.

- Use `rounded` (4px) for buttons, inputs, selects, tabs, and compact controls.
- Use `rounded-lg` (8px) for panels, cards, code blocks, and previews.
- Edge-to-edge workspace panels may be square when they meet the application frame or another flush workspace zone. Standalone panels and cards still use `rounded-lg`.
- Use `rounded-xl` (12px) only for status pills, chips, and small non-rectangular metadata containers.
- Use `rounded-full` only for dots, toggles, and circular icon targets.
- Avoid large pill-shaped command buttons unless the existing component pattern requires it.

## Dense Forms & Editor Workspaces
Forms are operational workspaces, not document-style pages. Keep them compact, explicit, and predictable across ExecutionProfiles, Markdown documents, Skills, Loop configuration, themes, and Runs.

- Render only one entity identity or workspace-title layer before the content. Do not repeat the entity name, status, section name, and editor mode in stacked header rows.
- Do not ship disabled tabs or toolbar controls for future functionality. Remove unavailable modes until they have real content and complete keyboard semantics.
- Use the Markdown Workbench pattern for text-heavy editors: one live Preview region, one Edit region, compact panel headers, metrics next to the editor, and Save/Delete actions in the Edit header.
- Use a compact inspector rail for entity identity and metadata. Give it one name/description/status block followed by edge-to-edge sections with an 88px label/value grid.
- Every control has an associated label. Connect descriptions and field errors with `aria-describedby`, set `aria-invalid` on the control, and show the exact error directly below the affected control. Use `fieldset` and `legend` for grouped choices.
- Show server or form-wide failures in one destructive Alert near the form start. A disabled Save control never replaces a visible validation explanation.
- Entity editors use explicit Save and expose dirty, valid, and pending state. Prevent duplicate submissions while pending. ExecutionProfile editing is explicit-save; runtime values are never autosaved from the Node editor.
- Use container-aware responsive layouts. Keep inspector, Preview, and Edit side by side only when each retains useful width; otherwise stack them in that order.
- Keep shadcn/Base UI primitives in `components/ui` and compose product-specific density, validation, status, panels, and actions in the shared application layer. Do not import Base UI primitives directly from feature views.
- Treat the selected Loop canvas as an immutable visual boundary during form work. Do not change its component, 50/50 canvas/sheet split, canvas controls, renderer, graph geometry, or `.loop-*` CSS while unifying adjacent forms.

## Components
- **Sidebar:** Treat the sidebar as an operational index, not a marketing navigation area. Use compact labels, icons, grouped sections, and clear selected state.
- **Buttons:** Primary buttons are solid Electric Blue. Secondary buttons are ghost or outline controls with subtle borders. Destructive buttons must use the error token family.
- **Status Chips:** Use a leading dot plus label. Emerald means running or healthy. Amber means queued, pending, or needs attention. Gray means unavailable, unknown, or archived. Use pulse animation only for live-running state.
- **ExecutionProfile Editor:** Use one Configure collection and detail route under `/execution-profiles`. The editor exposes only Name, Provider, Model, Reasoning effort, and Network access. Keep the identity and metadata rail compact with `inspector-title`, `inspector-body`, `inspector-value`, and `inspector-label`. Persist only through explicit Save, show the lowercase kebab-case ID as technical metadata, and never add instruction, skill, task, Transition, appearance, workspace-access, or machine-local controls.
- **Reasoning Glow:** Derive the selected Agent or Scheduled Step's glow from its ExecutionProfile reasoning effort using seven progressively wider, brighter, and more saturated levels in this order: `light`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`. Smaller efforts are grayer and dimmer; larger efforts approach the Loop theme's node glow color. Node artwork retains its intrinsic surface hues while the theme controls the independent outer halo. A missing or unavailable profile has no reasoning glow and is a blocking validation state; semantic Run status rings remain independent. Scheduled Steps retain CalendarClock while using the selected profile's glow.
- **Cards & Panels:** Use cards for repeated entities and panels for workspace regions. Do not place cards inside cards. Prefer headers with metadata and a compact command area. Standalone surfaces use `rounded-lg`; flush workspace regions use the square-edge exception. Present ExecutionProfiles, Skills, ADRs, Goals, Instructions, and All Loops as dense responsive collection grids. Place the same subdued dashed add card first where creation is supported and keep existing entities as compact metadata cards with an explicit Open action.
- **Tables & Lists:** Use tight row heights, clear separators, and zebra-striping with a 2% lighter surface tint when rows are dense. Keep row controls icon-first where possible.
- **Inputs:** Use dark surfaces, 1px borders, and Primary focus state. Validation messages must be explicit and adjacent to the field.
- **Run Timeline:** Use monospaced entries. Start each row with a muted timestamp, then the Step ID, Step type or provider source, result, and status. Use Emerald for approved results, Amber for waiting states, and Error for failed or blocked states.
- **CLI Run Console:** Render a selected ExecutionTask's persisted provider-neutral Codex or Copilot event stream in a dense dark monospaced console. Each row starts with a muted receipt time, provider source, and a fixed-width semantic type (`SYSTEM`, `THINK`, `AGENT`, `CMD`, `OUTPUT`, `FILE`, `TOOL`, `INFO`, `WARN`, or `ERROR`). Preserve command whitespace, allow horizontal scrolling, auto-follow only while the operator remains at the bottom, and expose reconnect and 1 MB truncation state explicitly. Display only provider-published reasoning summaries; never render hidden or raw chain-of-thought.
- **Local Runtime:** Use one dense local-host workspace instead of a machine registry. Show the hostname, current checkout, service uptime, active/busy counts, and a Codex/Copilot capability table with exact command, CLI version, authentication, models, policy capabilities, and health. Emerald is reserved for a ready provider, Amber for busy or attention, Gray for unavailable or unknown, and Error for a blocking health issue. Expose `Refresh capabilities` and `View logs`; lifecycle control belongs to the checkout-scoped CLI. Do not show machine search, device filters, Connect, pairing, restart, disconnect, or computer selection.
- **Local CLI Repair:** Provider authentication is always completed in the provider's local CLI. When a command is missing or authentication fails, show the exact local repair command in a copyable Geist block next to that provider. Never ask for Codex, GitHub, Git, or Ballet credentials, and never present device-code approval or pairing states.
- **Local Step Execution:** Keep portable provider, model, reasoning effort, and network intent in an ExecutionProfile in strict v9 `.ballet/project.json`. Keep provider command overrides and checkout-wide absolute `readOnlyRoots` in `.git/ballet/settings.json`. Agent and Scheduled Steps select one profile; the Node editor never edits its runtime values. There is no provider fallback, runtime attachment, Agent-specific local policy, or `workspaceAccess` field. A legacy `agentReadOnlyRoots` property is a blocking error with exact remediation and is never silently cleaned up.
- **Project Instructions Workbench:** Present `.ballet/instructions/**/*.md` resources as a responsive live Markdown Preview and Edit workspace. Reuse project Markdown rendering, technical editor typography, tonal panel boundaries, draft validation, word/token metrics, and explicit Save. Display title, `project:<id>`, relative path, and validation state. A document without a valid frontmatter ID remains visible as a document but is not selectable as a primary instruction.
- **Project Skills Collection:** Present `.agents/skills/**/SKILL.md` resources with title or name, path-derived `project:<relative-directory>` ID, relative path, and validation state. Invalid paths remain visible as blocking catalog errors. V1 snapshots and composes only the selected `SKILL.md`; no Built-in catalog, clone action, registry, or drag-reorder appears.
- **Markdown & Frontmatter Previews:** Render metadata in compact, code-like blocks. Use Geist and preserve exact key names. Separate preview content from editable controls with a visible tonal boundary.
- **Command & Filter Controls:** Use compact search, segmented filters, and command-bar patterns for fast navigation across projects, ExecutionProfiles, Loops, Steps, and Runs.
- **Loop Theme Editor:** Open the single project theme directly at `/automation/theme`. Use one full-width technical workspace with a fixed-height, non-interactive showcase composed of a grouped artwork gallery and a short edge/terminal canvas above dense Node, Edge, and Connection point control zones. The gallery shows every fixed node artwork at a representative independent size plus the fixed Route Loop summary artwork; the canvas demonstrates normal/rejected/cross-Loop edges, connection points, and completed/blocked/failed terminals without forcing the complete catalog into one unreadably long graph. The editor chrome always uses Ballet design tokens; project-defined hex colors are scoped to Loop canvases only. Preview valid draft changes immediately, keep invalid partial color input visibly adjacent to its field while retaining the last valid preview value, and persist only through an explicit Save command. Do not expose theme identity, copying, assignment, usage counts, or renderer-per-size controls.
- **Step Cards:** Use for Loop definitions and Run snapshots. Include the Step type, selected ExecutionProfile name when applicable, status, and a collapsed task description or Run input section.
- **Global Ballet Mode:** Place one text-first `Ballet` dropdown at the upper-left of the sidebar. Its popup offers `Run` and `Configure` with concise descriptions and a selected-state indicator. Do not render Loop- or Step-local mode controls. Configure contains Project documents, Project Instructions, Project Skills, Execution Profiles, Theme, and Loops. Run uses only `/run` and `/run/loops/:loopId?run=<rootRunId>`; standalone Agent Run routes do not exist. Preserve the selected Loop when switching modes and route Configure-only resources to Run Overview. The Run sidebar contains Overview, active Root Runs, and Loops.
- **Node Editor:** Agent and Scheduled Steps show controls in this order: Task description, Execution profile, Primary instruction, Skills, Approved target, Rejected target, collapsed Appearance, and collapsed Advanced. Profile and primary are required single selects. Skills are a keyboard-accessible Project-only multi-select whose removable chips are sorted by ID; duplicate and drag-reorder states cannot occur. Appearance contains Node style and Node size. Advanced contains Node ID, Step type, the Scheduled-Step schedule, and read-only composition IDs. Human Steps show only task, both Transition targets, Appearance, and Advanced. Terminal nodes render no Transition controls.
- **Step Composition Preview:** Replace the Agent instruction preview with a Step composition preview. Show the fixed System baseline, one Project primary instruction, selected Project skills in canonical ID order, composition validity, and every resource origin and ID. Do not display provider raw events or hidden reasoning. The Run view uses the immutable composition snapshot and exact prompt hash.
- **Run Sheet:** Keep the Run sheet beside the immutable canvas in the established 50/50 workspace. Give the entire sheet one compact StepRun metadata header. The left column is an immutable preview of the selected task's System, primary instruction, skills, IDs, origins, and prompt evidence. The right column contains the selected task's durable CLI console and structured outcome. For a Human Step, replace the console with the required Response field and explicit Approved and Rejected actions. Show finalization commit, changed files, or retained worktree when reported.
- **Loop Canvas Nodes:** Every Loop node owns an independent artwork style and size. The fixed six-style catalog contains Classic (`flat`, `luna`, `mars`, `terra`, `sol`) and Planets (`vector-planet`). The size catalog is Tiny 24px, Small 36px, Medium 48px, and Large 64px, and every style supports every size. New executable nodes default to Flat/Medium and terminal nodes to Flat/Tiny. Implement artwork as isolated code-native CSS and 24×24 inline-SVG components so selection, ExecutionProfile-derived reasoning glow, Run status, edge anchors, and reduced-motion behavior remain independent. Human nodes show Shield, and Scheduled Steps always show CalendarClock plus one muted Geist schedule line. Keep the exact node ID below every node.
- **Terminal Nodes:** Every v9 Loop owns exactly one `completed`, `blocked`, and `failed` terminal node whose ID equals its type. An Approved or Rejected Transition from any executable Step may target a local executable node, a local terminal, or another Loop. Terminals have no execution composition, schedule, Transition controls, outgoing edge, source handle, or downstream ghost. Their editor locks ID and Type, permits Description, Node style, and Node size, and may state `Terminal nodes have no transitions.`
- **Loop Canvas Interaction:** Theme normal, rejected, and cross-Loop edges independently as `solid`, `dashed`, or `dotted`; derive muted rejected and return strokes from the theme edge color, and preserve bright 5px connection points, smart-routed paths, cycles, Loop summaries, and the 24px grid. Route is the fixed Loop summary artwork and is neither configurable nor persisted. Configure makes executable and terminal nodes plus executable Transitions selectable and opens the established 50/50 canvas/sheet workspace. Persist `.ballet/project.json` only as strict v9. Creating or saving an executable Agent or Scheduled Step requires explicit ExecutionProfile and Project primary-instruction selections; never select a first profile or instruction silently. Ballet Run keeps fully resolved v9 Loops, Steps, Transitions, profiles, Project resources, System instruction, theme, artwork, and sizes immutable for the Root Run. It gives the active executable node a restrained Emerald pulse, gives a human-wait node an Amber pulse, and preserves active Transition animation. Pulses and Transition motion become static semantic highlights under `prefers-reduced-motion`.

## Do's and Don'ts
- Do use the token values in this file as the source of truth for UI color, spacing, radius, and typography decisions.
- Do prefer dense, scannable, work-focused screens over decorative landing-page composition.
- Do use Electric Blue, Emerald, and Amber as operational signals with consistent meanings.
- Do keep UI copy precise, short, and tied to concrete project, ExecutionProfile, Loop, Step, Transition, runtime, or Run state.
- Do keep visual hierarchy clear through typography scale, borders, and tonal layers.
- Don't introduce one-off colors, gradients outside the fixed node artwork presets, ornamental backgrounds, or large decorative illustrations.
- Don't use bright signal colors for passive decoration.
- Don't increase border radius beyond the defined scale for standard controls.
- Don't use hero-scale type inside dashboards, sidebars, cards, tables, editors, or panels.
- Don't hide operational state behind vague labels; expose exact status, owner, source, target, and timestamps where relevant.
