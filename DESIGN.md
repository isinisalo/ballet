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
  agent-inspector-title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
  agent-inspector-body:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  agent-inspector-value:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  agent-inspector-label:
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
Ballet is an agent operations command center for managing projects, goals, ADRs, agents, skills, runtimes, Loops, Steps, Transitions, and Runs. The interface must feel like a high-stakes AI operations workspace: dense, structured, technical, and calm under pressure.

The visual system uses **Modern Minimalism** fused with **Technical Industrialism**. Dark tonal layers reduce eye strain during long monitoring sessions, while high-vibrancy signal colors mark active decisions, agent state, Transition state, and Run urgency. The target users are DevOps engineers, AI architects, and operator agents who need fast scanning, reliable hierarchy, and low visual ambiguity.

## Colors
The palette is rooted in a deep, multi-layered dark mode.

Theme support is currently dark-only. Do not expose light or system theme modes unless a complete light palette is added to this file and implemented as first-class design tokens.

- **Primary (Electric Blue):** Use for primary commands, selected navigation, focused fields, and selected Loop nodes.
- **Secondary (Emerald):** Use for running agents, successful Step outcomes, accepted goals, healthy runtimes, and go-forward states.
- **Loop Flow (Mint):** Use as the built-in `open-ai` baseline for thin normal Loop connectors and active Transition glow, with the brighter `loop-connection-point` token for endpoint orbs. A resolved project theme may replace these colors and choose each edge pattern inside its Loop canvas only. Keep rejected and rework connectors semantically muted with a shade derived from the selected edge color.
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
- **Control Density:** Use 28px controls with 12px text for compact desktop forms and 32px controls with 14px text by default. At narrow mobile widths, use 40px controls and at least 16px input text to keep forms legible and prevent viewport zoom. Compact label/value forms use an 88px label column and stack labels above controls when that column would compress the value.
- **Functional Zones:** Separate navigation, collection lists, entity detail panels, previews, Run history, and editor surfaces into clear zones with borders and tonal layers.
- **Flow Visualization:** Use the compact composite Loop canvas for a selected Loop with Step-owned `small`, `medium`, and `large` node sizes at 28px, 44px, and 64px, fixed-scale panning, smart routed 1.5px paths, explicit Transition labels, and unobstructed return/cycle paths. Vertically center different-sized nodes that share a lane so their left/right connection points stay on one horizontal line and direct edges remain straight. Keep at least 208px of horizontal path clearance between full-size Step columns. Scope node, edge, label, and connection-point styling to the selected Loop's resolved project visualization theme. `default` and `open-ai` are built-in project defaults that a tracked `.ballet/themes/<theme-id>.json` file may override for every Loop using that ID. Project themes may select only the established flat, Luna, Terra, and Sol renderers; they do not define arbitrary CSS, gradients, or geometry. Present the All Loops overview as a dense responsive card grid rather than a second editable graph.
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
- Edge-to-edge workspace panels may be square when they meet the application frame or another flush workspace zone. Standalone panels and cards still use `rounded-lg`.
- Use `rounded-xl` (12px) only for status pills, chips, and small non-rectangular metadata containers.
- Use `rounded-full` only for dots, avatars, toggles, and circular icon targets.
- Avoid large pill-shaped command buttons unless the existing component pattern requires it.

## Dense Forms & Editor Workspaces
Forms are operational workspaces, not document-style pages. Keep them compact, explicit, and predictable across agents, Markdown documents, Skills, Loop configuration, themes, and Runs.

- Render only one entity identity or workspace-title layer before the content. Do not repeat the entity name, status, section name, and editor mode in stacked header rows.
- Do not ship disabled tabs or toolbar controls for future functionality. Remove unavailable modes until they have real content and complete keyboard semantics.
- Use the Markdown Workbench pattern for text-heavy editors: one live Preview region, one Edit region, compact panel headers, metrics next to the editor, and Save/Delete actions in the Edit header.
- Use a compact inspector rail for entity identity and metadata. Give it one avatar/name/description/status block followed by edge-to-edge sections with an 88px label/value grid.
- Every control has an associated label. Connect descriptions and field errors with `aria-describedby`, set `aria-invalid` on the control, and show the exact error directly below the affected control. Use `fieldset` and `legend` for grouped choices.
- Show server or form-wide failures in one destructive Alert near the form start. A disabled Save control never replaces a visible validation explanation.
- Entity editors use explicit Save and expose dirty, valid, and pending state. Prevent duplicate submissions while pending. Agent Execution is the only autosaved editor surface; label its autosave behavior and keep it separate from the explicit agent Save action.
- Use container-aware responsive layouts. Keep inspector, Preview, and Edit side by side only when each retains useful width; otherwise stack them in that order.
- Keep shadcn/Base UI primitives in `components/ui` and compose product-specific density, validation, status, panels, and actions in the shared application layer. Do not import Base UI primitives directly from feature views.
- Treat the selected Loop canvas as an immutable visual boundary during form work. Do not change its component, 50/50 canvas/sheet split, canvas controls, renderer, graph geometry, or `.loop-*` CSS while unifying adjacent forms.

## Components
- **Sidebar:** Treat the sidebar as an operational index, not a marketing navigation area. Use compact labels, icons, grouped sections, and clear selected state.
- **Buttons:** Primary buttons are solid Electric Blue. Secondary buttons are ghost or outline controls with subtle borders. Destructive buttons must use the error token family.
- **Agent Chips:** Use a leading dot plus label. Emerald means running or healthy. Amber means idle, queued, pending, or needs attention. Gray means offline, disabled, unknown, or archived. Use pulse animation only for live-running state.
- **Agent Editor Inspector:** Let the selected-agent editor use the full available workspace width. Keep its profile rail compact and dark at the base surface level: use `agent-inspector-title` with `on-surface` for the name, `agent-inspector-body` with `on-surface-variant` for description and row labels, `agent-inspector-value` with `on-surface` for technical values, and `agent-inspector-label` for uppercase section headings. Place an `Execution` section with a leading CPU icon directly in the profile rail; it owns compact Provider, Model, Reasoning effort, and Network access controls plus the existing Advanced policy disclosure. Save a valid Execution configuration automatically whenever one of its settings changes; do not render a separate save control. Do not show a Runtime/computer selector, an `Environment` tab, or a second execution surface on the right. `Reasoning effort` is the portable persisted execution setting: each provider maps it to its own reasoning/effort API. Status chips use the existing semantic state colors and the 12px inspector body size.
- **Agent Avatar:** Let an agent optionally select one compact avatar from the curated technical Lucide set: Bot, BrainCircuit, Code2, Compass, Hammer, Rocket, Search, or Sparkles. Keep `None` as an explicit option. Show the avatar preview in the Agent Editor profile rail and use it inside an agent Step node only when the selected Loop theme enables agent avatars. Avatar selection is agent metadata and never changes runtime execution.
- **Reasoning Glow:** Visualize a bound agent's explicit Reasoning effort as seven progressively wider, brighter, and more saturated background-glow levels in this order: `light`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`. Smaller efforts are grayer and dimmer; larger efforts approach the resolved Loop theme's node glow color. Luna, Terra, and Sol retain their established intrinsic surface hues while the project theme controls their shared outer halo. `Provider default` and unbound agents do not receive the additional reasoning glow; semantic Run status rings remain independent.
- **Cards & Panels:** Use cards for repeated entities and panels for workspace regions. Do not place cards inside cards. Prefer headers with metadata and a compact command area. Standalone surfaces use `rounded-lg`; flush workspace regions use the square-edge exception.
- **Tables & Lists:** Use tight row heights, clear separators, and zebra-striping with a 2% lighter surface tint when rows are dense. Keep row controls icon-first where possible.
- **Inputs:** Use dark surfaces, 1px borders, and Primary focus state. Validation messages must be explicit and adjacent to the field.
- **Run Timeline:** Use monospaced entries. Start each row with a muted timestamp, then the Step ID, agent or human source, result, and status. Use Emerald for approved results, Amber for waiting states, and Error for failed or blocked states.
- **CLI Run Console:** Render a selected ExecutionTask's persisted provider-neutral Codex or Copilot event stream in a dense dark monospaced console. Each row starts with a muted receipt time, provider source, and a fixed-width semantic type (`SYSTEM`, `THINK`, `AGENT`, `CMD`, `OUTPUT`, `FILE`, `TOOL`, `INFO`, `WARN`, or `ERROR`). Preserve command whitespace, allow horizontal scrolling, auto-follow only while the operator remains at the bottom, and expose reconnect and 1 MB truncation state explicitly. Display only provider-published reasoning summaries; never render hidden or raw chain-of-thought.
- **Local Runtime:** Use one dense local-host workspace instead of a machine registry. Show the hostname, current checkout, service uptime, active/busy counts, and a Codex/Copilot capability table with exact command, CLI version, authentication, models, policy capabilities, and health. Emerald is reserved for a ready provider, Amber for busy or attention, Gray for unavailable or unknown, and Error for a blocking health issue. Expose `Refresh capabilities` and `View logs`; lifecycle control belongs to the checkout-scoped CLI. Do not show machine search, device filters, Connect, pairing, restart, disconnect, or computer selection.
- **Local CLI Repair:** Provider authentication is always completed in the provider's local CLI. When a command is missing or authentication fails, show the exact local repair command in a copyable Geist block next to that provider. Never ask for Codex, GitHub, Git, or Ballet credentials, and never present device-code approval or pairing states.
- **Local Agent Execution:** Keep portable provider, model, reasoning effort, and network intent in the top-level `agents` map of `.ballet/project.json`; keep provider command overrides and absolute read-only roots in `.git/ballet/settings.json`. The `Execution` section edits both surfaces as one resolved configuration while clearly identifying portable and machine-local values. Require an explicit provider, model, and reasoning selection before Run; there is no provider fallback. Present workspace-only access as the fixed baseline. An agent definition may be saved without a complete execution configuration, but Run must show every exact preflight or configuration issue and a direct path to Local Runtime. The current checkout's host is always the execution runtime, and local settings persist across restarts without attachments or recovery heuristics.
- **Agent Instructions Workbench:** Present agent instructions as a responsive live Markdown Preview and Edit workspace without an additional tab or introductory header. Reuse the project Markdown rendering, technical editor typography, tonal panel boundary, draft validation, word/token metrics, and explicit Save agent action. Keep TOML metadata in the profile rail and do not introduce YAML frontmatter into agent instructions.
- **Markdown & Frontmatter Previews:** Render metadata in compact, code-like blocks. Use Geist and preserve exact key names. Separate preview content from editable controls with a visible tonal boundary.
- **Command & Filter Controls:** Use compact search, segmented filters, and command-bar patterns for fast navigation across projects, agents, Loops, Steps, and Runs.
- **Loop Theme Editor:** Use one full-width technical workspace with a fixed-height, non-interactive showcase canvas above dense Node, Edge, and Connection point control zones. The editor chrome always uses Ballet design tokens; project-defined hex colors are scoped to the Loop canvas only. Preview valid draft changes immediately, keep invalid partial color input visibly adjacent to its field, and persist only through an explicit Save command. Treat a theme ID as project-shared and show how many Loops use it.
- **Step Cards:** Use for Loop definitions and Run snapshots. Include the Step type, agent identity when applicable, status, and a collapsed description or Run input section.
- **Global Ballet Mode:** Place one text-first `Ballet` dropdown at the upper-left of the sidebar. The trigger remains an unboxed label at rest and reveals its compact rounded control surface, chevron, and border on hover, focus, or open. Its popup offers `Run` and `Configure` with concise descriptions and a selected-state indicator. Do not render Loop- or agent-local mode controls. Configure keeps the existing mutable resource routes. Run uses `/run`, `/run/loops/:loopId?run=<rootRunId>`, and `/run/agents/:agentId?run=<rootRunId>`. Preserve the selected Loop or agent when switching modes; route Configure-only resources to Run Overview. The Run sidebar contains Overview, active root Runs, Loops, and agents. Overview shows active roots first, target readiness and preflight reasons, then recent Runs with source, current position, normalized status, and finalization.
- **Run Sheet:** Keep the Run sheet beside the immutable canvas in the established 50/50 workspace. Give the entire sheet one compact StepRun metadata header. The left column is an immutable Markdown preview of the selected task's snapshotted agent instructions. The right column contains the selected task's durable CLI console and structured outcome. For a human Step, replace the console with the required Response field and explicit Approved and Rejected actions. Show finalization commit, changed files, or retained worktree when reported. Open the durable console stream only for the selected task; use the shared Run invalidation stream to refetch lists and detail.
- **Loop Canvas Nodes:** Every Step owns a `small`, `medium`, or `large` node size, mapped to 28px, 44px, or 64px in every theme. Built-in `open-ai` maps these sizes to Luna, Terra, and Sol; a project theme may assign any established renderer to any size without changing its texture or geometry. `default` uses a flat `surface-container-highest` circle with a restrained Primary glow. Show the bound agent's avatar only when the resolved theme enables it; human and scheduled Steps always show their Shield or CalendarClock semantic mark. Keep the exact `step.id` below the node and add only one muted Geist schedule line for scheduled Steps. CSS radial gradients are allowed only inside the established Luna, Terra, and Sol renderer presets, including when a project theme selects those presets. Keep related Loop summaries and terminal targets as compact 22px rounded technical markers. Theme normal, rejected, and cross-Loop edges independently as `solid`, `dashed`, or `dotted`; derive muted rejected and return strokes from the theme edge color, and preserve bright 5px connection points, smart-routed paths, cycles, Loop summaries, and the 24px grid. Configure makes Step nodes and Transitions selectable and opens the established 50/50 canvas/sheet workspace. Keep Once/Recurring schedule controls compact in the Step editor and expose the exact next and latest scheduler states without adding a second editable canvas. Ballet Run keeps the fully resolved theme, size, and avatar snapshots immutable, gives the active agent node a restrained Emerald pulse, gives a human-wait node an Amber pulse, and preserves the active Transition animation. Pulses and Transition motion must become static semantic highlights under `prefers-reduced-motion`. In the All Loops card overview, show each Loop's ID, start Step, agent/human/scheduled Step counts, and directly referenced next Loops. Keep theme editing in the shared Theme library opened from the Automation header.

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
