---
version: alpha
name: Ballet Matte Workbench
description: Dark-first product UI for Ballet orchestration tools.
colors:
  primary: "#5d8cff"
  background: "#151517"
  surface: "#1f1f21"
  surface-raised: "#262628"
  input: "#2b2b2e"
  border: "#55555d"
  text: "#f1f1f3"
  text-muted: "#aaaab3"
  action: "#5d8cff"
  on-action: "#151517"
  danger: "#c84d4d"
  light-background: "#f6f6f7"
  light-surface: "#ffffff"
  light-surface-raised: "#f0f0f2"
  light-input: "#ffffff"
  light-border: "#d6d6dc"
typography:
  heading:
    fontFamily: Inter Variable
    fontSize: 1.35rem
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: 0
  body:
    fontFamily: Inter Variable
    fontSize: 0.9rem
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  label:
    fontFamily: Inter Variable
    fontSize: 0.82rem
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: 0
rounded:
  control: 6px
  panel: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
components:
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: 12px
  input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: 34px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.control}"
    height: 34px
  panel-raised:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: 12px
---

## Overview

Ballet is a compact orchestration workbench, not a marketing site. The interface should feel like a calm native tool: matte dark surfaces, restrained contrast, clear labels, and dense but readable forms.

Dark theme is the primary design target. Light theme must remain coherent, but it is secondary.

## Colors

Use dark charcoal surfaces instead of pure black. Use muted gray borders instead of bright white outlines. Use one blue action color for primary commands and reserve red for destructive actions only.

## Typography

Use Inter everywhere. Keep labels compact and firm. Do not use negative letter spacing. Avoid oversized headings inside tool panels and editors.

## Layout

Prefer a split list-and-editor model for configuration tools. Resource lists sit on the left, the selected editor sits on the right. The editor should usually fit in one normal desktop viewport.

## Elevation & Depth

Use one level of matte panel depth. Avoid nested card walls, decorative gradients, glows, and high-contrast outlines.

## Shapes

Panels use 8px radius. Controls and icon buttons use 6px radius. Avoid large pill shapes unless the component is explicitly a segmented control.

## Components

Forms use filled dark controls with subdued borders. Buttons are compact. Primary buttons use Ballet blue. Native selects should visually match text inputs and textareas.

Advanced user-facing forms must not expose raw ids, source dumps, dependency lists, dry-run widgets, delete-safety panels, or hidden details sections unless the user explicitly asks for technical debug UI.

## Do's and Don'ts

- Do keep dark UI matte, soft, and compact.
- Do use list + editor for resource configuration.
- Do keep `Dark / Light / System` visible.
- Do not use pure black backgrounds with pure white borders.
- Do not hide ordinary form information in disclosure sections.
- Do not reintroduce `Advanced details`, `Resource details`, or `Advanced source` into primary forms.
