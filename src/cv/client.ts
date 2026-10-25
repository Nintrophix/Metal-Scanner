// Main-thread wrapper around the detection worker. Only the latest request resolves;
// superseded runs are rejected so slider scrubbing never applies stale results.
import type { Detection, DetectOptions, Stage } from './pipeline';
import type { WorkerRequest, WorkerResponse } from './worker';

export class Superseded extends Error {}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (r: { result: Detection; ms: number }) => void; reject: (e: Error) => void; onStage?: (s: Stage) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const p = pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'stage') p.onStage?.(msg.stage);
    else {
      pending.delete(msg.id);
      if (msg.type === 'done') p.resolve({ result: msg.result, ms: msg.ms });
      else p.reject(new Error(msg.message));
    }
  };
  return worker;
}

export function runDetection(img: ImageData, options: DetectOptions, onStage?: (s: Stage) => void) {
  const id = ++seq;
  for (const [k, p] of pending) {
    p.reject(new Superseded());
    pending.delete(k);
  }
  return new Promise<{ result: Detection; ms: number }>((resolve, reject) => {
    pending.set(id, { resolve, reject, onStage });
    const copy = new Uint8ClampedArray(img.data);
    const req: WorkerRequest = { id, width: img.width, height: img.height, data: copy, options };
    getWorker().postMessage(req, [copy.buffer]);
  });
}
