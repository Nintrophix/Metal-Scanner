# context.md — Irontronics Part Scanner

## Project Overview
A browser-based computer vision tool that accepts a live camera feed or uploaded photo of a flat metal piece, detects its outline and bolt holes, measures all dimensions in millimetres, lets the user edit those dimensions (the geometry itself changes), and exports G-code for CNC routers, laser cutters, or plasma cutters, plus DXF, SVG, and JSON. Everything runs in the browser; photos never leave the machine.

---

## Problem Statement
Metal fabrication shops manually measure parts using callipers and then re-enter dimensions into CAM software to generate cutting paths. This is slow, error-prone, and requires CAD/CAM expertise. The goal was to collapse that entire workflow into a single scan-and-click step.

---

## Ownership
**Krithiv Shankar** — Irontronics  
Owned: camera capture pipeline, image processing algorithms, pixel-to-mm calibration system, hole detection, G-code generation engine, and the full frontend UI.

---

## Tech Stack

### Current (v1.1 build in this repository)
| Layer | Technology |
|---|---|
| App | React 18 + TypeScript, Vite 5 (hash routing: `#/` landing, `#/app` workspace, `#/app?sample` loads the sample part) |
| Styling | Plain CSS with design tokens (`src/styles/tokens.css`), Geist Sans / Geist Mono via `@fontsource` (self-hosted) |
| Icons | `lucide-react` |
| Image Processing | Canvas API for decode/downscale; pure TypeScript CV pipeline in a Web Worker (`src/cv/`) |
| Camera Input | WebRTC — `navigator.mediaDevices.getUserMedia()` with device picker |
| 2D view | SVG plan view rendered in screen space (`src/workspace/plan/`) |
| 3D view | three.js extrusion with OrbitControls, lazy-loaded chunk |
| Persistence | `localStorage` (calibration profiles, machining settings, unit preference) |
| Output | RS-274 / NGC G-code, DXF R12 ASCII, SVG (mm), JSON |
| Tests | Vitest (`npm test`), ESLint (`npm run lint`), `tsc` (`npm run typecheck`) |

Commands: `npm install`, `npm run dev` (http://localhost:5173), `npm run build`, `npm run preview`, `npm test`, `npm run lint`, `npm run icons` (regenerates PNG icons from the mark).

### Recommended Future Stack
| Layer | Technology |
|---|---|
| CV (Browser) | OpenCV.js (WebAssembly) |
| CV (Server) | Python + OpenCV (`cv2`) |
| Backend | FastAPI / Flask |
| ML Layer | ONNX Runtime / SAM2 / Claude API |
| Geometry | `shapely` (Python) |
| Machine Link | GRBL WebSocket serial bridge |
| Packaging | Electron / Docker |
| Camera HW | Raspberry Pi Cam v3 + Ring Light |

---

## Source Layout
```
index.html                 Boot screen (inline, painted before JS), meta, icons
public/                    favicon.svg, PNG icons, web manifest
scripts/make-icons.mjs     Zero-dependency PNG rasteriser for the mark
src/App.tsx                Router, boot-screen hand-off, lazy workspace
src/landing/               Landing page (real plan renderer in the product window)
src/workspace/             Workspace shell, Scan/Edit/Export panels, 3D view
src/workspace/plan/        SVG drawing (pills, datums, arcs, toolpath) and interactive viewport
src/cv/                    Detection pipeline, worker, worker client
src/geom/                  Polygon maths, edit operations, validation
src/export/                G-code, DXF, SVG generators
src/state/                 Reducer store with undo/redo, detection → part conversion
src/lib/                   Units/parsing, image sources, synthetic sample, storage
```

---

## CV Algorithm Pipeline
```
Raw Camera Frame / Uploaded Photo
        ↓
Downscale to ≤1400 px long side (processing copy)
        ↓
Grayscale Conversion (luminance formula)
        ↓
Histogram Analysis → Otsu Thresholding (auto, or manual override)
        ↓
Binary Segmentation (foreground = part; optional invert)
        ↓
Connected Components Analysis (BFS, 4-connectivity) → largest region
        ↓
Moore-Neighbor Boundary Tracing
        ↓
Douglas-Peucker Polygon Simplification (closed curve, split at farthest pair)
        ↓
Border-Flood-Fill Hole Detection
        ↓
Least-squares (Kåsa) circle fit per hole; area-based diameter as fallback
        ↓
Pixel-to-mm Calibration Transform (+ half-pixel outward correction)
        ↓
Editable part model (mm, y-up, origin at outline minimum)
        ↓
Polygon Offset (tool radius compensation, mitred joins)
        ↓
RS-274 G-code / DXF / SVG / JSON
```
Measured on the synthetic sample (6 px/mm): overall size within 0.2 mm, hole diameters within 0.05 mm, hole centres within 0.01 mm.

---

## G-code Output Coverage
| Code | Function |
|---|---|
| G21 | Units = millimetres |
| G90 | Absolute positioning |
| G94 | Feed rate in mm/min |
| G17 | XY plane |
| G0 | Rapid move |
| G1 | Linear cut, plunges, peck steps |
| G2 | Clockwise arc (bore cycles, laser holes; two half arcs per circle) |
| G4 | Pierce dwell (laser/plasma) |
| M3 | Spindle / laser on |
| M5 | Spindle / laser off |
| M30 | Program end |

Order: holes first, then the outline. Mill mode is conventional milling with M3 (outline counter-clockwise, holes clockwise). Peck drilling is written as explicit G1/G0 moves (no G83) for GRBL compatibility.

---

## Key Features
- Landing page, boot screen, favicon / app icons / manifest
- Three-stage workspace: **Scan → Edit → Export**
- Live camera preview with device picker and frame capture; photo upload and drag-and-drop
- Synthetic sample photo (clearly labelled) for trying the pipeline without a camera
- Two-point pixel-to-mm calibration with named, saved profiles; resolution-mismatch warning
- Otsu auto-threshold + manual slider over a live histogram; invert mode; smoothing tolerance; minimum hole size
- Detection runs in a Web Worker with real stage-by-stage status
- Plan view in the sample's language: edge-length pills, overall-dimension pills, datum lines 1/2/A/B, red active measurement with angle arcs, hole datum dimensions
- Editing that changes geometry: stretch edge to length (or move end point), overall width/height, vertex X/Y, drag vertices with alignment snapping, insert/delete vertices, add/move/resize/delete holes (ISO 273 clearance presets), square-up, round-to-grid, uniform scale
- Undo/redo (200 steps, labelled), revert to scan
- Compare: neutral dashed overlay of the original scan plus a change table
- Validation: self-intersection, holes outside/breaking through/overlapping, thin webs, bore smaller than tool, uncalibrated, machining values; export blocked on errors
- Measure tool with vertex/hole-centre snapping (distance, Δx, Δy)
- Units: mm / in display and input; inputs accept arithmetic and unit suffixes (`120+5`, `0.5in`)
- 3D extruded preview (thickness = stock depth setting, not measured) with original-outline overlay
- Mill mode (multi-pass) and Laser/Plasma mode; outside / on-line / inside offset; drill (peck) / bore / skip holes; toolpath overlay with start point and direction
- G-code / DXF / SVG / JSON preview, copy, download; cut length and feed-time estimate
- Keyboard shortcuts (`?` in the workspace lists them)

---

## Design System (summary)
Light, restrained, derived from the owner's sample UI (light floorplan editor). Tokens live in `src/styles/tokens.css`: cool canvas `#f3f3f6`, white panels, 1 px hairlines `#e5e5ea`, one indigo accent `#5a5fe6` (primary action, selection, dimension pills), red `#e0444c` only for the active measurement and errors. Geist Sans for UI, Geist Mono only for numbers. Outlined pills mark overall (reference) dimensions. Motion is limited to 120–180 ms state transitions. The full record is in `DESIGN.md`.

---

## Constraints & Assumptions
- Camera must be mounted directly overhead (orthographic view)
- Part must be on a flat, high-contrast, matte background
- Lighting must be even — no strong glare on shiny metal surfaces
- Single part per frame only (largest connected region)
- Calibration is linear (no lens distortion or perspective correction)
- Thickness is never measured; the 3D view uses the stock depth setting
- No machine link: files are downloaded; programs are not simulated
