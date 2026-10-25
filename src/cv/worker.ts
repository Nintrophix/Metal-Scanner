/// <reference lib="webworker" />
import { detect, DetectionError, type DetectOptions, type Stage } from './pipeline';

export type WorkerRequest = { id: number; width: number; height: number; data: Uint8ClampedArray; options: DetectOptions };
export type WorkerResponse =
  | { id: number; type: 'stage'; stage: Stage }
  | { id: number; type: 'done'; result: ReturnType<typeof detect>; ms: number }
  | { id: number; type: 'error'; message: string; expected: boolean };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, width, height, data, options } = e.data;
  const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);
  const t0 = performance.now();
  try {
    const result = detect(data, width, height, options, (stage) => post({ id, type: 'stage', stage }));
    post({ id, type: 'done', result, ms: performance.now() - t0 });
  } catch (err) {
    post({ id, type: 'error', message: err instanceof Error ? err.message : String(err), expected: err instanceof DetectionError });
  }
};
