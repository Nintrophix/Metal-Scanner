# Product

<!-- impeccable:product-schema 1 -->

> Inferred from `context.md`, `updates.md`, and the owner's build brief (2026-10-25). No interview was run; the owner asked for autonomous execution. Items marked *(inferred)* should be confirmed.

## Platform

web

## Stack

delegated: Vite + React + TypeScript (the stack `context.md` lists as the recommended future stack), Canvas/Web Worker computer vision with no CV library, three.js for the extruded preview, Vitest for algorithm tests. Runs fully in the browser; no backend.

## Users

Fabricators, machinists, and makers in small metal shops who need to reproduce or modify a flat metal part (bracket, plate, gasket, flange) without re-measuring it by hand with callipers and re-drawing it in CAD/CAM. *(inferred: comfortable with mm, G-code, and CNC/laser/plasma machines; not necessarily CAD experts.)*

## Product Purpose

Irontronics turns a top-down photo of a flat metal part into a measured, editable 2D profile (outline + bolt holes) and exports machine-ready G-code, DXF, or SVG. Success: a part goes from bench to cut file in minutes, with dimensions the operator can trust and adjust.

## Positioning

A scan-to-cut pipeline in one browser tab: camera → calibrated outline and holes → dimension edits that change the real geometry → RS-274 G-code with tool-radius compensation. No CAD package, no install, no server.

## Operating Context

- Camera mounted directly overhead (orthographic), part on flat, matte, high-contrast background, even lighting.
- Two-point pixel-to-mm calibration against a known reference, reused across sessions.
- Output feeds CNC routers (mill mode, multi-pass), laser and plasma cutters (single pass, M3/M5), and CAD (DXF/SVG).

## Capabilities and Constraints

- Single part per frame; flat parts only (thickness is a stock setting, never measured).
- Linear calibration only; no lens-distortion or perspective correction.
- Glare on shiny metal breaks thresholding; hardware lighting is the fix.
- Hole diameter comes from a least-squares circle fit (area-based estimate as fallback).
- Never present fabricated scan results, measurements, formats, or hardware connectivity. No direct machine link (GRBL bridge is a future item).

## Brand Commitments

- Name: **Irontronics**. Owner: Krithiv Shankar.
- The owner supplied a sample UI (light floorplan editor: white panels, thin borders, indigo dimension pills, red active measurement, dashed datum lines with circled labels) as the binding visual reference.
- Understated, precise, professional; no neon, glow, heavy gradients, glass, or decorative motion.

## Evidence on Hand

- No customer logos, testimonials, benchmarks, or pricing exist. Do not invent them.
- A synthetic sample image (generated in-app, labeled as synthetic) is the only demonstration material.

## Product Principles

1. Measurements are the product: every number shows its unit and its provenance (calibrated or not).
2. Edits change geometry, never just labels.
3. Show the limits of the scan honestly; block export on invalid geometry.
4. The part is the focal point; tools stay at the edges.

## Accessibility & Inclusion

Keyboard operable workspace (shortcuts plus focusable controls), WCAG AA contrast for text, visible focus rings.
