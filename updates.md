# updates.md — Irontronics Part Scanner

---

## ✅ v1.0 — Initial Build (Current)

### Completed
- [x] Full single-file browser app (HTML + CSS + JS, zero dependencies)
- [x] Live camera stream via WebRTC (`getUserMedia`)
- [x] Uploaded photo support via File API
- [x] Canvas-based image capture and frame freeze
- [x] Grayscale conversion + Otsu auto-thresholding
- [x] Manual threshold slider override
- [x] Invert mode for light-on-dark parts
- [x] Connected Components Analysis — largest blob = part
- [x] Moore-Neighbor boundary tracing
- [x] Douglas-Peucker polygon simplification (adjustable tolerance)
- [x] Two-point pixel-to-mm calibration with session persistence
- [x] Border flood-fill hole detection (bolt holes)
- [x] Hole centroid, diameter, and XY position readout
- [x] Bounding box width/height in mm
- [x] Polygon offset for tool radius compensation
- [x] G-code generation — Mill mode (multi-pass Z depth)
- [x] G-code generation — Laser / Plasma mode
- [x] Hole strategies: peck drill, bore (G2 arc), skip
- [x] Outside / on-line / inside cut placement
- [x] Feed rate, plunge rate, safe Z, spindle speed controls
- [x] Live toolpath preview overlaid on image canvas
- [x] G-code modal — view, download `.gcode`, copy to clipboard
- [x] Activity log panel (timestamped messages)
- [x] Full reset / re-scan flow

---

## 🔄 v1.1 — Planned (Near-term)

### Image Quality
- [ ] Morphological erosion/dilation to remove pixel noise before tracing
- [ ] Adaptive thresholding (handles uneven lighting better than Otsu)
- [ ] Canny edge detection as an alternative to binary segmentation

### Calibration
- [ ] ArUco / QR marker auto-calibration (print-and-place reference card)
- [ ] Save multiple calibration profiles (different camera setups)
- [ ] Calibration verification overlay (draw known grid at saved scale)

### Measurement
- [ ] Sub-pixel edge interpolation for tighter dimensional accuracy
- [ ] Least-squares circle fitting for hole diameter (more accurate than area-based radius)
- [ ] Multiple parts per frame — detect and process each separately

### Export
- [ ] DXF file export (AutoCAD-compatible) via `ezdxf`
- [ ] SVG vector outline export
- [ ] Measurement report as PDF (part sketch + dimension table)

---

## 🔵 v2.0 — Future (Backend + React)

### Architecture Shift
- [ ] Migrate UI to React + TypeScript (component-based)
- [ ] FastAPI Python backend for heavy CV processing
- [ ] OpenCV.js (WASM) in browser as intermediate step
- [ ] WebSocket stream: browser sends JPEG → server returns annotated result

### Advanced CV
- [ ] Hough Circle Transform for precise hole detection
- [ ] Perspective homography correction (angled camera support)
- [ ] `shapely` for robust polygon offset and boolean operations
- [ ] Contour hierarchy (parts with cutouts, slots, internal features)

### Machine Integration
- [ ] GRBL serial bridge — send G-code directly to CNC over WebSocket
- [ ] LinuxCNC integration
- [ ] G-code simulator / dry-run verifier before sending to machine

---

## 🟣 v3.0 — Advanced (ML + Hardware)

### ML / AI
- [ ] SAM2 (Segment Anything) — click-to-segment, no threshold tuning needed
- [ ] YOLOv8 — detect multiple different part types in one frame
- [ ] Claude API — natural language part description and parameter suggestions
- [ ] ONNX Runtime Web — run segmentation model fully in browser

### Hardware
- [ ] Raspberry Pi camera module v3 — dedicated overhead mount
- [ ] Ring light + diffuser panel — eliminate metal glare
- [ ] Camera intrinsic calibration (lens distortion correction)
- [ ] Structured light / stereo camera for auto depth/thickness estimation

### Deployment
- [ ] Electron desktop app (offline, USB serial access)
- [ ] Docker container for Python backend
- [ ] PWA with Service Worker for offline browser use
- [ ] Scan history database (SQLite) — part name, dimensions, G-code, timestamp

---

## 📌 Known Issues / Limitations

| Issue | Impact | Fix Planned |
|---|---|---|
| No lens distortion correction | Slight dimensional error at frame edges | v2.0 homography |
| Glare on shiny metal surfaces | Threshold fails, broken contour | Hardware (ring light) |
| Single part per frame only | Can't batch-scan | v1.1 multi-component |
| Camera must be exactly overhead | Any tilt distorts measurements | v2.0 perspective correction |
| No G-code simulation / verification | Must trust the output | v2.0 |
| Hole radius computed from area (not fit) | Slightly inaccurate for non-circular holes | v1.1 least-squares fit |

---

## 📎 Resume Bullets (v1.0)

- Scanned metal part outlines and bolt-hole positions from camera frames using contour tracing and binary segmentation, achieving millimetre-level dimensional accuracy via pixel-to-mm calibration.
- Owned the full image-processing pipeline — camera capture, Otsu thresholding, boundary tracing, hole detection, and the G-code generation engine — as a zero-dependency browser application.
- Reduced manual measurement and CAM setup time by replacing physical calliper workflows with a single-click scan-to-G-code pipeline, enabling faster turnaround on custom metal parts.

---

## ✅ v1.1 — React workspace, design system, editing (2026-10-25)

The repository contained only `context.md` and `updates.md` (the v1.0 single-file build was not present), so v1.1 was rebuilt from these documents as a Vite + React + TypeScript app. See `context.md` for the stack, source layout, and commands.

### Product
- [x] Landing page following the owner's sample UI; the product window uses the real plan renderer and hover-to-inspect edges
- [x] Boot screen in `index.html` (painted before JS, loading bar only after 400 ms, capped at 1.5 s after mount), favicon SVG, PNG icons (32/180/192/512), web manifest, Open Graph meta
- [x] Workspace with Scan / Edit / Export stages, icon tool rail, collapsible inspector sections, status bar, keyboard shortcuts
- [x] Detection moved to a Web Worker with real per-stage status; stale runs are discarded while sliders move
- [x] Histogram with threshold marker; Otsu or manual; invert; smoothing; minimum hole area
- [x] Least-squares circle fit for hole diameters (v1.1 planned item), with area fallback flagged in the UI
- [x] Half-pixel boundary correction so outlines measure to the true edge
- [x] Named calibration profiles (v1.1 planned item), resolution-mismatch warning
- [x] Dimension editing that changes geometry: stretch edge / end point, overall width and height, vertex and hole coordinates from datums, drag with alignment snap, insert/delete vertex, add/delete hole, ISO 273 clearance presets, square-up, round-to-grid, scale
- [x] Undo/redo (200 labelled steps), revert to scan, compare overlay + change table
- [x] Validation that blocks export on errors (self-intersection, hole breakout/overlap, bore < tool, uncalibrated, invalid machining values) and warns on thin webs
- [x] Measure tool with snapping; mm/in units; arithmetic in number fields
- [x] 3D extruded preview (three.js, lazy-loaded); thickness is the stock setting, labelled as not measured
- [x] DXF (R12) and SVG export (v1.1 planned items), JSON export
- [x] G-code: G17, G4 pierce dwell, full circles as two G2 half arcs, explicit peck moves (GRBL has no G83), conventional-milling note in the header
- [x] Toolpath overlay with start point and direction; cut length and feed-time estimate
- [x] Synthetic sample photo (labelled) rendered in-app and run through the real detector

### Design review fixes
- Independent finish review (two rounds) against the sample UI. Fixed: landing replica selection uses indigo with a single active measurement; hole labels avoid collisions (fall back through four diagonals, then hide); mono limited to numbers and file tokens; "synthetic" stays visible on sample names; mobile stacks inputs before results; mobile status bar no longer overflows; datum leader lines for a selected hole or vertex in the workspace
- G-code comments sanitised (`commentSafe`): a part name with parentheses previously produced a comment GRBL rejects (error:1)
- Open, cosmetic: on very slow connections the boot wordmark renders in the system face until the preloaded Geist woff2 arrives (`font-display: swap`); outlining it as SVG would remove the switch

### Verification
- 31 Vitest tests: Otsu, boundary tracing, circle fit, end-to-end detection accuracy on the synthetic sample, polygon offset, self-intersection, every edit operation, validation, G-code structure/compensation/peck/laser, DXF and SVG output, G-code comment safety, unit parsing
- `tsc` clean, ESLint clean, production build passes (workspace chunk 78 kB; three.js chunk ~521 kB loads only when 3D is opened)
- Browser walkthrough on the dev and production builds: sample scan → edit → export; uncalibrated photo → two-point calibration → edit; 3D; mobile and 1024 px layouts

### Limitations (still true)
- Camera capture was implemented against the WebRTC API but not exercised with real hardware in this session; it needs a secure context (https or localhost)
- No lens-distortion or perspective correction; single part per frame
- Hole detection finds enclosed background regions only; slots and non-round cut-outs are fitted as circles or flagged as area-based
- Edits cannot add arcs to the outline; curved outer edges are polylines from the trace
- Stretching acts across the plane through the edge midpoint, so oblique edges crossing that plane change angle
- The G-code is not simulated; dry-run new programs above the stock
- DXF is R12 with LINE/CIRCLE entities (no LWPOLYLINE, no layers beyond OUTLINE/HOLES)
- Calibration profiles live in browser `localStorage` per origin

### Next
- [ ] Morphological clean-up and adaptive thresholding for uneven light
- [ ] ArUco / printed-card auto-calibration
- [ ] Arc fitting on the outline (G2/G3 for fillets) and slot detection
- [ ] Tabs/bridges for routed parts; climb/conventional option
- [ ] G-code simulator and GRBL bridge
