import type { Detection } from '../cv/pipeline';
import { cleanOutline } from '../geom/edit';
import { bbox, ensureCCW, offsetPolygon, type Part, type Vec } from '../geom/polygon';

/**
 * Maps processing-image pixels to world units (mm when calibrated, source pixels otherwise):
 * world = (px·k − ox, (H − py)·k − oy). y flips so the part is y-up.
 */
export type Frame = { k: number; ox: number; oy: number; H: number };

export const pxToWorld = (f: Frame, p: Vec): Vec => ({ x: p.x * f.k - f.ox, y: (f.H - p.y) * f.k - f.oy });
export const worldToPx = (f: Frame, p: Vec): Vec => ({ x: (p.x + f.ox) / f.k, y: f.H - (p.y + f.oy) / f.k });

/**
 * Converts a pixel-space detection into a part (y-up, origin at the outline's minimum corner).
 * The traced boundary runs through boundary-pixel centres, so the outline is pushed out by
 * half a pixel to sit on the true edge.
 */
export function detectionToPart(det: Detection, k: number): { part: Part; frame: Frame } {
  const raw: Frame = { k, ox: 0, oy: 0, H: det.height };
  const outline = offsetPolygon(ensureCCW(cleanOutline(det.polygon.map((p) => pxToWorld(raw, p)))), 0.5 * k);
  const b = bbox(outline);
  const frame: Frame = { k, ox: b.minX, oy: b.minY, H: det.height };
  return {
    frame,
    part: {
      outline: outline.map((p) => ({ x: p.x - b.minX, y: p.y - b.minY })),
      holes: det.holes.map((h, i) => ({ id: `h${i + 1}`, ...pxToWorld(frame, { x: h.cx, y: h.cy }), d: h.d * k })),
    },
  };
}
