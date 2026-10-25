// Turning files, camera frames, and the synthetic sample into detector-ready sources.
import type { Source } from '../state/store';
import { renderSampleRGBA, SAMPLE_HEIGHT, SAMPLE_WIDTH } from './sample';

/** Long-side limit for the processing copy; detection stays well under a second at this size. */
export const PROC_MAX = 1400;

function toProc(src: CanvasImageSource, w: number, h: number): { proc: ImageData; procScale: number } {
  const procScale = Math.min(1, PROC_MAX / Math.max(w, h));
  const pw = Math.max(1, Math.round(w * procScale));
  const ph = Math.max(1, Math.round(h * procScale));
  const c = document.createElement('canvas');
  c.width = pw;
  c.height = ph;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, pw, ph);
  return { proc: ctx.getImageData(0, 0, pw, ph), procScale: pw / w };
}

export async function sourceFromFile(file: File): Promise<Source> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image. Use a JPEG, PNG, or WebP photo.`);
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`${file.name} could not be decoded as an image.`);
  }
  const { proc, procScale } = toProc(img, img.naturalWidth, img.naturalHeight);
  return { kind: 'upload', name: file.name, url, width: img.naturalWidth, height: img.naturalHeight, proc, procScale };
}

export function sourceFromVideo(video: HTMLVideoElement): Promise<Source> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(video, 0, 0, w, h);
  const { proc, procScale } = toProc(c, w, h);
  return new Promise((resolve, reject) =>
    c.toBlob((blob) => {
      if (!blob) return reject(new Error('Could not capture the camera frame.'));
      const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
      resolve({ kind: 'camera', name: `capture-${stamp}.png`, url: URL.createObjectURL(blob), width: w, height: h, proc, procScale });
    }, 'image/png'),
  );
}

export function sourceFromSample(): Source {
  const data = renderSampleRGBA();
  const c = document.createElement('canvas');
  c.width = SAMPLE_WIDTH;
  c.height = SAMPLE_HEIGHT;
  const ctx = c.getContext('2d')!;
  ctx.putImageData(new ImageData(data, SAMPLE_WIDTH, SAMPLE_HEIGHT), 0, 0);
  const { proc, procScale } = toProc(c, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  return { kind: 'sample', name: 'Synthetic sample bracket', url: c.toDataURL('image/png'), width: SAMPLE_WIDTH, height: SAMPLE_HEIGHT, proc, procScale };
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(s: string) {
  return s.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'part';
}
