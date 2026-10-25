---
name: Irontronics
description: Photo of a flat metal part in, calibrated profile and G-code out.
colors:
  accent: "#5a5fe6"
  accent-hover: "#4a4fd6"
  accent-press: "#3f43c2"
  accent-ink: "#3d41b8"
  accent-line: "#c9cbf7"
  accent-soft: "#eeeffd"
  plinth: "#ebebf7"
  red: "#e0444c"
  red-ink: "#b42a32"
  red-line: "#f2c4c7"
  red-soft: "#fdeeee"
  amber: "#a86a0c"
  amber-line: "#f0dcb4"
  amber-soft: "#fcf4e4"
  green: "#2c7a54"
  green-line: "#c4e3d2"
  green-soft: "#e8f5ee"
  canvas: "#f3f3f6"
  surface: "#ffffff"
  surface-sunk: "#f8f8fa"
  surface-hover: "#f2f2f5"
  border: "#e5e5ea"
  border-strong: "#d3d3da"
  divider: "#ececf0"
  text: "#1c1c22"
  text-2: "#55555f"
  text-3: "#74747e"
  metal: "#e4e5ea"
  metal-edge: "#8d8e9a"
  metal-edge-strong: "#6b6c78"
  datum: "#b9bac6"
typography:
  display:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 1.2rem + 2.6vw, 3.125rem)"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 1.1rem + 1.2vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'ss01' on"
  body-marketing:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  control:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  label:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
  numeric:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' on"
  pill:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "10.5px"
    fontWeight: 500
    fontFeature: "'tnum' on"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  window: "10px"
  pill: "9px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  section: "96px"
  section-mobile: "64px"
  topbar: "48px"
  statusbar: "28px"
  rail: "44px"
  panel-left: "248px"
  panel-right: "280px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "28px"
  button-hover:
    backgroundColor: "{colors.surface-hover}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "28px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-active:
    backgroundColor: "{colors.accent-press}"
  button-primary-disabled:
    backgroundColor: "{colors.accent-line}"
  button-lg:
    padding: "0 14px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: "28px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  segmented:
    backgroundColor: "{colors.surface-sunk}"
    rounded: "{rounded.md}"
    padding: "2px"
  segmented-item:
    textColor: "{colors.text-2}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "0 9px"
    height: "22px"
  segmented-item-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
  dimension-pill:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: "0 7px"
    height: "18px"
  dimension-pill-active:
    backgroundColor: "{colors.red}"
    textColor: "{colors.surface}"
  dimension-pill-reference:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-ink}"
  datum-bubble:
    backgroundColor: "{colors.surface-sunk}"
    textColor: "{colors.text-2}"
    size: "18px"
  tag:
    backgroundColor: "{colors.surface-sunk}"
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 7px"
    height: "20px"
  tag-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
  tag-error:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red-ink}"
  issue-error:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red-ink}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  issue-warning:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  issue-ok:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  section-header:
    textColor: "{colors.text}"
    typography: "{typography.control}"
    height: "36px"
    padding: "0 10px 0 8px"
  canvas-toolbar:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "4px"
  status-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    height: "28px"
    padding: "0 12px"
  rail-button:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    size: "32px"
  rail-button-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
---

# Design System: Irontronics

## Overview

**Creative North Star: "The Drawing Is the Interface"**

Irontronics looks like a light, quiet floorplan editor that happens to cut metal. The part drawing sits on a cool near-white canvas in the middle. White inspector panels, a top bar, an icon rail, and a status bar stay at the edges, separated by 1px hairlines. The drawing carries the information: dimensions sit on the geometry as small indigo pills, dashed datum lines with circled labels frame the part, and the measurement in focus turns red. Everything else holds back so that the part and its numbers are the loudest things on screen.

The density is set for a working tool. The UI is 13px, controls are 28px tall, and inspector sections are compact and separated by hairlines. The landing page uses the same world at a larger scale: white ground, a large left-aligned Geist headline, and the real editor shown in a product window on a pale indigo plinth. It is not a separate marketing skin. The owner's sample UI (a light floorplan editor) is the binding reference. The brand stays understated and precise, with no neon, glow, heavy gradients, glass, or decorative motion.

**Key Characteristics:**
- Cool neutral canvas (#f3f3f6) under white panels, with 1px hairlines doing the structural work.
- One periwinkle-indigo accent for primary action, selection, and every dimension.
- Red reserved for the single active measurement and for errors.
- Geist Sans for words and Geist Mono for numbers, and only numbers.
- Flat chrome. Shadows appear only on things that float over the canvas.

## Colors

A cool, very lightly blue-tinted grey scale with one saturated indigo voice, plus red, amber, and green used strictly as signals.

### Primary
- **Periwinkle Indigo** (accent): primary buttons, selected rail tools, active tabs and stage underlines, the focus ring, dimension pills, vertex handles, snap guides, toolpaths, and the brand mark. Hover deepens to **Pressed Indigo** (accent-hover), and active deepens further (accent-press).
- **Indigo Ink** (accent-ink): indigo used as text, such as the active stage, active tab, selected list ID, accent tags, links, and the text inside outline reference pills.
- **Indigo Wash** (accent-soft) and **Indigo Hairline** (accent-line): selected list rows, active rail button, accent tags, and the 3px focus halo around fields. accent-line also serves as the disabled primary fill and the text selection colour.
- **Plinth Lavender** (plinth): used only behind the landing product window, as the lower band of the stage.

### Secondary
- **Measurement Red** (red): the selected edge (2.5px stroke), its two angle arcs, the datum leader lines for a selected hole or vertex, those dimension pills, and invalid-field borders. **Red Ink** (red-ink), **Red Wash** (red-soft), and **Red Hairline** (red-line) are used for error text, error issues, error toasts, and canvas error notes.

### Tertiary
- **Workshop Amber** (amber, amber-soft, amber-line): warnings only, in warning issues, warning notes, status-bar warnings, and warning tags.
- **Pass Green** (green, green-soft, green-line): the valid-geometry confirmation, OK tags, and OK toasts.

### Neutral
- **Drafting Canvas** (canvas): the drawing ground, the landing closing band, the boot screen, and the theme colour.
- **Panel White** (surface): panels, top bar, status bar, rail, buttons, fields, and the landing page ground.
- **Sunk Grey** (surface-sunk): segmented-control tracks, tags, stats blocks, datum bubble fill, and alternate landing sections.
- **Hover Grey** (surface-hover): hover fill for buttons, rail buttons, and list rows.
- **Hairline** (border), **Firm Hairline** (border-strong), **Divider** (divider): border is the 1px rule for every panel edge and control. border-strong marks hover borders and the datum bubble stroke. divider separates sections inside a panel.
- **Graphite** (text), **Slate** (text-2), **Pewter** (text-3): primary text, secondary labels and inactive tabs, and units, hints, and placeholders.
- **Sheet Metal** (metal), **Metal Edge** (metal-edge), **Metal Edge Strong** (metal-edge-strong): the part fill, hole centre crosshairs, and the 1.5px part outline.
- **Datum Grey** (datum): dashed datum lines (5 5).

### Named Rules
**The One Voice Rule.** Indigo is the only accent. It marks what you can act on, what is selected, and what is measured. No second brand colour exists.

**The Red Means Now Rule.** Red marks the one measurement currently in focus (selected edge, its angles, and its datum leaders) and errors. Nothing decorative, navigational, or merely "on" is red.

## Typography

**Display Font:** Geist Sans (with ui-sans-serif, system-ui, Segoe UI)
**Body Font:** Geist Sans
**Label/Mono Font:** Geist Mono (with ui-monospace, SFMono-Regular, Menlo, Consolas)

**Character:** Geist Sans is a neutral, engineered grotesk that stays quiet at 11 to 13px and turns confident when set tight at display size. Geist Mono with tabular figures makes every measurement column line up like a drawing table. Weights in use are 400, 500, and 600. 700 is never used.

### Hierarchy
- **Display** (600, clamp 2 to 3.125rem, line-height 1.06, -0.035em, balanced): the landing hero headline only, left-aligned, two lines.
- **Headline** (600, clamp 1.5 to 2rem, 1.15, -0.025em): landing section titles.
- **Title** (600, 1rem, -0.01em): landing step titles. Inside the workspace, the empty-state title uses 1.125rem.
- **Body** (400, 13px, 1.45, stylistic set ss01): the workspace base. Landing body runs at 14px with 1.55 to 1.6 line-height and a 52 to 62ch measure. The hero lede uses 1.0625rem.
- **Control** (500, 12px): buttons, segmented items, tabs, field text, list rows, and section toggles (section toggles use 600).
- **Label** (500, 11px): field labels, hints, notes, tags, the status bar, and unit suffixes.
- **Numeric** (Geist Mono 400, 12px, tabular, -0.01em): every length, angle, coordinate, count, and G-code line.
- **Pill** (Geist Mono 500, 10.5px): dimension text on the drawing.

### Named Rules
**The Mono Is for Numbers Rule.** Geist Mono sets numerals and their glyphs (Ø, °, %) and machine code. Units next to a number (mm, in) go back to Geist Sans in Pewter. Words never appear in mono.

**The Sentence Case Rule.** All labels, buttons, and headings use sentence case, with no uppercase tracking. Hierarchy comes from weight (500 vs 600) and colour (text, text-2, text-3), not size jumps.

## Layout

The workspace is a fixed application grid. A 48px top bar holds breadcrumbs on the left, the Scan/Edit/Export stages in the centre, and units, zoom, and export on the right. Below it sit a 44px icon rail, a 248px left inspector, the flexible canvas, and a 280px right inspector, with a 28px status bar at the bottom. The canvas always gets the remaining space. Panels scroll on their own while the canvas never scrolls. Inspector sections have a 36px header and a body with 12px horizontal padding and 10px gaps.

Spacing runs on a 4/6/8/12/16px rhythm for chrome and 96px vertical padding for landing sections (64px on mobile). The landing content column is `min(1180px, 100% - 32px)`. Text blocks cap at 52 to 62ch. Landing structure comes from hairline-topped rows and columns (the four-step flow, the spec list, the limits grid), not from cards.

Responsive behaviour:
- **1180px and below:** inspectors narrow to 220px and 252px, and the breadcrumb root hides.
- **960px and below:** both inspectors stack in the right column, the canvas keeps full height, and the units toggle hides.
- **720px and below:** the top bar wraps and stages drop to a centred second row. The canvas takes 62vh beside the rail. The left and then the right inspector flow below at full width, and the status bar becomes sticky.
- **Landing:** at 1080px the flow becomes 2 columns and the split stacks. At 760px nav links hide, the flow becomes 1 column, and the product window drops its rail and inspectors to show the canvas alone at 380px tall.

## Elevation & Depth

The chrome is flat. Panels, sections, and controls separate through tonal steps (canvas, then surface, then surface-sunk) and 1px hairlines. Shadow appears only on elements that float above the canvas or the page.

### Shadow Vocabulary
- **Pop** (`0 6px 24px -6px rgba(24,24,40,0.14), 0 1px 3px rgba(24,24,40,0.06)`): menus, sheets, toasts, and canvas notes.
- **Window** (`0 30px 60px -24px rgba(30,30,70,0.28), 0 2px 6px rgba(30,30,70,0.06)`): the landing product window only.
- **Toolbar lift** (`0 1px 2px rgba(20,20,40,0.05)`): the floating canvas toolbar.
- **Selected segment** (`0 1px 2px rgba(20,20,40,0.08), 0 0 0 1px var(--border)`): the selected item in a segmented control.
- **Focus halo** (`0 0 0 3px var(--accent-soft)`, or red-soft when invalid): fields on focus.

### Named Rules
**The Float-Only Shadow Rule.** If it sits inside the panel grid, it has no shadow. Only overlays on the canvas and transient layers cast one.

## Shapes

Corners are small and consistent. Inner pieces like segment items, tags, and list rows use 4px. Controls, fields, issues, and toasts use 6px. Menus, sheets, the canvas toolbar, and code blocks use 8px. The landing product window uses 10px. Fully round shapes carry meaning: 9px-radius dimension pills, 9px-radius datum circles, 6px status dots, and 7px landing flow nodes. Active tabs and stages use a 2px indigo underline that sits on the hairline below them, not a filled background. Drawing strokes are thin: 1px datums and guides, 1.5px part outline, 2.5px selected edge. Dash patterns encode meaning: datum 5 5, leader and arc 3 3, crosshair 2 2, toolpath 6 3, compare overlay 4 3.

## Components

### Buttons
Compact, quiet, and confident.
- **Shape:** 6px corners, 28px tall (36px for the large variant), 6px icon gap, 12px/500 text.
- **Default:** white with a hairline border. Hover moves to hover grey and a firm hairline. Active uses the divider grey.
- **Primary:** indigo fill with white text. Hover goes deeper, active deeper again. Disabled uses an indigo-hairline fill.
- **Ghost:** transparent until hovered. **Danger:** red-ink text on the default button. **Selected tool** (canvas toolbar): indigo wash with indigo ink.
- **Transitions:** background, border, and colour at 120ms. Keyboard focus shows a 2px indigo outline offset 2px.

### Segmented Controls
- **Track:** sunk grey, hairline, 6px corners, 2px inset.
- **Items:** 22px tall, 4px corners, slate text. The selected item lifts to white with the selected-segment shadow. Used for units, resize mode, view mode, and machine profile.

### Inputs / Fields
- **Style:** 28px, white, hairline, 6px corners. Prefix (such as Ø) and suffix (mm, %, °) appear in 11px Pewter Sans. Numeric inputs use mono.
- **Focus:** indigo border plus a 3px indigo-wash halo. **Invalid:** red border plus a 3px red-wash halo. **Disabled:** sunk grey with slate text.
- **Select:** the same field with a 10px chevron drawn in Pewter.

### Sections (Inspector)
- A caret plus a 12px/600 title in a 36px header, with optional right-side actions (small checks, buttons). The body has 12px side padding and 10px gaps. A divider closes each section. Rows pair an 11px/500 slate label with a field. Readouts are justified label/value lines with mono values and Pewter Sans units.

### Tabs, Stages, and Lists
- Tabs and top-bar stages use slate text. The active item turns indigo ink with a 2px indigo underline. Tab counts appear in 10px Pewter mono.
- List rows are 28px with 4px corners. They hover to hover grey, and when selected take the indigo wash with an indigo-ink ID.

### Tags and Issues
- **Tag:** 20px, 4px corners, 11px/500, as a sunk-grey neutral or as accent, warn, ok, or error tints (wash fill, matching hairline, ink text).
- **Issue:** a full-width 6px-corner row with a 6px 8px pad and a 14px outline icon leading 12px text. Error is red wash, warning amber wash, OK green wash. Clickable issues show a currentColor border on hover.

### Canvas Toolbar and Status Bar
- **Canvas toolbar:** floats 10px from the canvas's top-right corner. White, hairline, 8px corners, 4px pad, toolbar lift. Its buttons and segmented control lose their borders.
- **Status bar:** 28px white strip with a top hairline, 11px slate text, 16px item gaps, 6px status dots, mono figures, amber for warnings, and a flexible spacer before the right-aligned edit state.

### Drawing Conventions (Signature)
- **Dimension pill:** 18px tall, fully rounded, 10.5px Geist Mono 500, white on indigo. It is offset 16px outward along the edge normal, and its width follows its text.
- **Active pill:** the same pill in red, used for the selected edge, its angle arcs, and its datum dimensions.
- **Reference pill:** white fill, 1px indigo stroke, and indigo-ink text. Used for the overall width and height, placed outside the part (46px below, 52px right), so overall dimensions read apart from edge lengths.
- **Datum system:** dashed Datum Grey lines through the bounding box. 18px circled labels in sunk grey with a firm-hairline stroke and 10px/500 slate text, with columns labelled 1 and 2 and rows labelled A and B.
- **Angle arcs:** 1px red dashed (3 3) arcs at both ends of the selected edge, each with a red degree pill.
- **Leader lines:** 1px solid red from datum 1 and datum B to a selected hole or vertex, each with a red pill.
- **Holes:** dashed 2 2 crosshairs in Metal Edge (red when selected, plus a 2px red ring). Diameter pills are prefixed Ø and placed on the first free diagonal. A label is dropped rather than allowed to collide.
- **Vertices:** 8px handles with 1.5px corners, white with an indigo stroke, filled indigo when selected.

### Brand Mark
An indigo rounded square (5.5/24 radius) with a white bracket silhouette and an indigo bolt hole. It sits next to the 600-weight "Irontronics" wordmark with -0.01em tracking. The same mark is used for the favicon and the boot screen.

### Boot Screen
A canvas-grey screen with the centred mark and wordmark, plus a 132px by 2px hairline track with a 36% indigo runner (1.1s loop). It fades in after a delay so fast loads never flash it.

## Do's and Don'ts

### Do:
- **Do** put measurements on the geometry as pills and keep tools in the edge panels. The canvas stays the largest region at every breakpoint.
- **Do** use indigo for every dimension, selection, and primary action, and red only for the single measurement in focus and for errors.
- **Do** set every number in Geist Mono with tabular figures, and its unit in Geist Sans Pewter.
- **Do** separate surfaces with 1px hairlines (border, divider) and tonal steps before reaching for shadow.
- **Do** keep controls at 28px height with 6px corners and 12px/500 text.
- **Do** frame the part with dashed datums and circled 1/2/A/B labels, and render overall dimensions as outline reference pills.
- **Do** respect reduced motion. Transitions use 120ms or 180ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`.

### Don't:
- **Don't** use red for toggles, overlays, emphasis, or decoration.
- **Don't** use a second accent hue, gradients beyond the flat plinth band, glow, glass, or neon.
- **Don't** wrap landing content in cards. Use hairline-ruled rows and columns.
- **Don't** set words, labels, or units in mono, or use uppercase-tracked labels.
- **Don't** give in-grid panels, sections, or rows a shadow.
- **Don't** introduce a dark "tech console" theme or a dashboard of metric cards.
