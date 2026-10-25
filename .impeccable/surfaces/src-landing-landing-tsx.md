---
version: 1
slug: "src-landing-landing-tsx"
primary_target: "src/landing/Landing.tsx"
related_targets: ["src/workspace/Workspace.tsx"]
---

# Irontronics — landing + workspace

Scope: `src/landing/*` (Persuade) and `src/workspace/*` (Operate), one visual world pinned by the owner's sample UI (light floorplan editor). Visitor: fabricators and machinists reproducing flat metal parts. Task: photo → calibrated outline + holes → dimension edits → G-code/DXF/SVG.

## Direction contract

THESIS: The part drawing is the interface. Dimensions live on the geometry as pills, datums frame it, panels stay at the edges. Refuses the dashboard-of-cards and the dark "tech" console.
OWN-WORLD: Cool near-white canvas (#f3f3f6), white panels, 1px #e5e5ea hairlines, one periwinkle-indigo accent (#5a5fe6) for selection, primary action, and dimension pills; red (#e0444c) only for the active measurement and errors. Dashed datum lines with circled labels 1/2/A/B. Geist Sans for UI, Geist Mono only for numbers.
STORY: Visitor sees the actual editor measuring a bracket, understands photo → cut file in one viewport, opens the workspace or the sample part.
FIRST VIEWPORT: Left-aligned two-line headline, one sentence, Open workspace (primary) + Try the sample part; below, a full-width product window (workspace replica, real renderer) on a pale indigo plinth, hover edges to inspect.
FORM: Owner-pinned world from the sample UI; no concept roll was run because a pinned direction beats the roll. seed: none (owner-pinned, not rolled)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
