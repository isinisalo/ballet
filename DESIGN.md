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
  background: '#111316'
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
---

## Brand & Style
Ballet is an agent operations command center for managing projects, goals, ADRs, agents, skills, runtimes, Loops, Steps, Transitions, and Runs. The interface must feel like a high-stakes AI operations workspace: dense, structured, technical, and calm under pressure.

The visual system uses **Modern Minimalism** fused with **Technical Industrialism**. Dark tonal layers reduce eye strain during long monitoring sessions, while high-vibrancy signal colors mark active decisions, agent state, Transition state, and Run urgency. The target users are DevOps engineers, AI architects, and operator agents who need fast scanning, reliable hierarchy, and low visual ambiguity.

## Colors
The palette is rooted in a deep, multi-layered dark mode.

Theme support is currently dark-only. Do not expose light or system theme modes unless a complete light palette is added to this file and implemented as first-class design tokens.

- **Primary (Electric Blue):** Use for primary commands, selected navigation, focused fields, graph flow paths, and the active Transition through a Loop.
- **Secondary (Emerald):** Use for running agents, successful Step outcomes, accepted goals, healthy runtimes, and go-forward states.
- **Tertiary (Amber):** Use for warnings, idle agents, queued Steps, human-wait states, and attention states that do not require destructive styling.
- **Error:** Use only for failed or blocked Runs, invalid Loop state, destructive commands, and blocking validation errors.
- **Background & Surfaces:** Use `#111316` for the application base. Use `#1a1c1f`, `#1e2023`, and `#282a2d` for functional containers, nested panels, and elevated work areas. Keep borders subtle but visible with `#414755` or lower-contrast variants.

## Typography
Use **Inter** for the main interface. Use **Geist** for technical data, Step Transitions, Run inputs, CLI excerpts, file paths, identifiers, timestamps, and frontmatter previews.

- Use **headline-lg** for main workspace titles only.
- Use **headline-md** and **headline-sm** for section-level hierarchy inside project, agent, Loop, Step, runtime, and Run views.
- Use **body-md** as the default application text style.
- Use **label-caps** for sidebar section labels, metadata labels, status group headings, and compact table headers.
- Use **code-md** for TOML, YAML, Markdown frontmatter, JSON input, Step definitions, terminal output, and Transition targets.
- Keep technical labels concise. Prefer exact entity names, status values, and timestamps over descriptive prose.

## Layout & Spacing
The layout follows a fluid grid with sidebar-heavy navigation and dense operational workspaces.

- **Desktop:** Use a 12-column grid. Keep primary navigation sidebars fixed near 280px when expanded. Let the main workspace remain fluid and scrollable.
- **Data Density:** Keep density high but structured. Use the 4px spacing unit. Default vertical rhythm between related controls is 8px or 16px. Use 20px panel padding for primary work areas.
- **Functional Zones:** Separate navigation, collection lists, entity detail panels, previews, Run history, and editor surfaces into clear zones with borders and tonal layers.
- **Flow Visualization:** Use the compact composite Loop canvas for a selected Loop: 22px technical Step markers, fixed-scale panning, smart routed 2px paths, explicit Transition labels, and unobstructed return/cycle paths. Use Primary for normal flow, the semantic rejected treatment for rework, and Secondary animation for the Transition taken by the displayed Run. Present the All Loops overview as a dense responsive card grid rather than a second editable graph.
- **Mobile:** Stack panels vertically. Convert sidebars to sheets or drawers. Keep key filters and commands reachable from a persistent top or bottom control.

## Elevation & Depth
Depth is conveyed through tonal layering first and shadows second.

- **Level 0 (Base):** Use `#111316` for the application background.
- **Level 1 (Panels):** Use `#1a1c1f` or `#1e2023` with a 1px border. Do not add decorative shadows.
- **Level 2 (Modals/Popovers):** Use `#1e2023` with a visible border, a subtle 10% white inner edge, and a restrained dark shadow.
- **Active State:** Elements currently selected, edited, monitored, or focused may receive a 4px Primary glow at 20% opacity.
- **Disabled State:** Lower opacity and reduce contrast. Do not change the shape language or introduce new colors.

## Shapes
The shape language is **Soft-Industrial**. Keep controls precise and compact.

- Use `rounded` (4px) for buttons, inputs, selects, tabs, and compact controls.
- Use `rounded-lg` (8px) for panels, cards, code blocks, and previews.
- Use `rounded-xl` (12px) only for status pills, chips, and small non-rectangular metadata containers.
- Use `rounded-full` only for dots, avatars, toggles, and circular icon targets.
- Avoid large pill-shaped command buttons unless the existing component pattern requires it.

## Components
- **Sidebar:** Treat the sidebar as an operational index, not a marketing navigation area. Use compact labels, icons, grouped sections, and clear selected state.
- **Buttons:** Primary buttons are solid Electric Blue. Secondary buttons are ghost or outline controls with subtle borders. Destructive buttons must use the error token family.
- **Agent Chips:** Use a leading dot plus label. Emerald means running or healthy. Amber means idle, queued, pending, or needs attention. Gray means offline, disabled, unknown, or archived. Use pulse animation only for live-running state.
- **Cards & Panels:** Use cards for repeated entities and panels for workspace regions. Do not place cards inside cards. Prefer headers with metadata and a compact command area.
- **Tables & Lists:** Use tight row heights, clear separators, and zebra-striping with a 2% lighter surface tint when rows are dense. Keep row controls icon-first where possible.
- **Inputs:** Use dark surfaces, 1px borders, and Primary focus state. Validation messages must be explicit and adjacent to the field.
- **Run Timeline:** Use monospaced entries. Start each row with a muted timestamp, then the Step ID, agent or human source, result, and status. Use Emerald for approved results, Amber for waiting states, and Error for failed or blocked states.
- **CLI Run Console:** Render a selected ExecutionTask's persisted provider-neutral Codex or Copilot event stream in a dense dark monospaced console. Each row starts with a muted receipt time, provider source, and a fixed-width semantic type (`SYSTEM`, `THINK`, `AGENT`, `CMD`, `OUTPUT`, `FILE`, `TOOL`, `INFO`, `WARN`, or `ERROR`). Preserve command whitespace, allow horizontal scrolling, auto-follow only while the operator remains at the bottom, and expose reconnect and 1 MB truncation state explicitly. Display only provider-published reasoning summaries; never render hidden or raw chain-of-thought.
- **Runtime Device Registry:** Use a responsive master-detail workspace. The compact left rail contains machine search, `All | Online | Issues` filters, hostname, provider marks, live state, and active/busy counts. The detail surface shows device identity and diagnostics above a dense Codex/Copilot capability table. Emerald is reserved for a connected and ready backend, Amber for busy or attention, Gray for disconnected, and Error for a blocking health issue. Expose `Refresh capabilities`, `View logs`, `Request restart`, and `Disconnect`; do not expose a web Stop action for an outbound-only daemon.
- **Computer Pairing:** Use a focused multi-step dialog for install command, device-code approval, waiting, expiry/error, and provider readiness. Present Homebrew first and the verified curl installer as the alternative. Keep exact commands in copyable Geist blocks. Provider authentication is always completed locally, so the web dialog shows the local repair command and never asks for Codex, GitHub, or Git credentials.
- **Agent Execution Binding:** Keep portable agent definition fields separate from an `Execution` section. Require an explicit `<device> · <provider>`, model, and reasoning selection before Run; there is no first-runtime fallback. Present workspace-only access as the fixed baseline, with network access and absolute read-only roots under Advanced. An agent definition may be saved unbound, but its Run action must show the exact preflight reason and a direct path to the Runtime Device Registry.
- **Markdown & Frontmatter Previews:** Render metadata in compact, code-like blocks. Use Geist and preserve exact key names. Separate preview content from editable controls with a visible tonal boundary.
- **Command & Filter Controls:** Use compact search, segmented filters, and command-bar patterns for fast navigation across projects, agents, Loops, Steps, and Runs.
- **Step Cards:** Use for Loop definitions and Run snapshots. Include the Step type, agent identity when applicable, status, and a collapsed description or Run input section.
- **Edit/Run Mode:** Place a compact segmented `Edit | Run` control next to the selected Loop identity and persist the mode in the URL. Edit shows the mutable saved definition; Run shows an immutable snapshot graph with live Step Run statuses. Lock Edit while the selected Loop has an active Run. In Run mode, keep manual input and Start visible when idle, the required response input with Approved and Rejected controls while waiting for a human, and Cancel while active.
- **Loop Canvas Nodes:** Render selected-Loop Steps, related Loop summaries, and terminal targets as compact 22px rounded technical markers. Agent and human identity is conveyed by the marker icon and semantic border; the exact `step.id` appears as the compact monospace edge-end label used by the original Loop editor. Preserve explicit `approved` and `rejected` labels, smart-routed return paths, cycles, compact upstream/downstream Loop summaries, and the 24px grid. Edit mode makes Step nodes and Transitions selectable and opens the established 50/50 canvas/sheet workspace. Run mode keeps the snapshot immutable, changes only marker status/glow, and animates the taken Transition. In the All Loops card overview, show each Loop's ID, start Step, agent/human Step counts, and directly referenced next Loops.

## Do's and Don'ts
- Do use the token values in this file as the source of truth for UI color, spacing, radius, and typography decisions.
- Do prefer dense, scannable, work-focused screens over decorative landing-page composition.
- Do use Electric Blue, Emerald, and Amber as operational signals with consistent meanings.
- Do keep UI copy precise, short, and tied to concrete project, agent, Loop, Step, Transition, runtime, or Run state.
- Do keep visual hierarchy clear through typography scale, borders, and tonal layers.
- Don't introduce one-off colors, gradients, ornamental backgrounds, or large decorative illustrations.
- Don't use bright signal colors for passive decoration.
- Don't increase border radius beyond the defined scale for standard controls.
- Don't use hero-scale type inside dashboards, sidebars, cards, tables, editors, or panels.
- Don't hide operational state behind vague labels; expose exact status, owner, source, target, and timestamps where relevant.
