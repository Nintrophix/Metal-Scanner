# Irontronics Part Scanner

A browser-based tool that turns a top-down photo of a flat metal part into a measured, editable 2D profile (outline + bolt holes) and exports machine-ready G-code, DXF, or SVG. Everything runs in the browser: no backend, and photos never leave your machine.

## Features

- **Capture**: live camera (WebRTC, with device picker) or an uploaded photo.
- **Scan**: grayscale + Otsu thresholding, connected-components part detection, boundary tracing and polygon simplification, hole detection with least-squares circle fitting. Runs in a Web Worker.
- **Calibrate**: two-point pixel-to-mm calibration against a known reference, remembered between sessions.
- **Edit**: change dimensions and the geometry itself updates.
- **Preview**: SVG plan view and a lazy-loaded three.js 3D extrusion.
- **Export**: RS-274 G-code (mill mode with multi-pass depth, or laser/plasma mode) with tool-radius compensation, plus DXF and SVG.

## Getting started

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the printed local URL. `#/app?sample` loads a sample part.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest algorithm tests |

## Stack

React 18, TypeScript, Vite 5, three.js, Vitest, plain CSS with design tokens.

## Limitations

- One flat part per frame; thickness is a stock setting, not measured.
- Linear calibration only (no lens-distortion or perspective correction).
- Needs an overhead camera, a matte contrasting background, and even lighting; glare on shiny metal breaks thresholding.
- No direct machine connection; export a file and load it in your controller.

## Project docs

See `PRODUCT.md`, `DESIGN.md`, `context.md`, and `updates.md`.
