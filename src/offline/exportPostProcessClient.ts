import type { ExportPhaseTimingsMs } from "./exportPhaseTimings";
import type { ExportProfile } from "./exportProfiles";
import type { ExportPostProcessInput, ExportPostProcessResult } from "./exportPostProcessCore";
import { runExportPostProcess, runWavEncodeOnly } from "./exportPostProcessCore";
import type {
  ExportPostProcessWorkerRequest,
  ExportPostProcessWorkerResponse,
} from "./exportPostProcessWorker";
import type { CanonicalRenderPlan } from "./renderPlanning";

let workerInstance: Worker | null = null;
let jobCounter = 0;

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./exportPostProcessWorker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

function getWorker(): Worker | null {
  if (!workerInstance) workerInstance = createWorker();
  return workerInstance;
}

export function terminateExportPostProcessWorker(): void {
  workerInstance?.terminate();
  workerInstance = null;
}

function nextJobId(): string {
  jobCounter += 1;
  return `export-post-${jobCounter}`;
}

export async function postProcessEvidenceExport(
  input: ExportPostProcessInput,
  signal?: AbortSignal,
): Promise<ExportPostProcessResult> {
  const worker = getWorker();
  if (!worker) return runExportPostProcess(input, signal);
  const response = await runInWorker(
    worker,
    { type: "evidence", jobId: nextJobId(), input },
    signal,
    input.channels.map((channel) => channel.buffer as ArrayBuffer),
  );
  if (response.type !== "complete") {
    throw new Error("Unexpected worker response for evidence export.");
  }
  return response.result;
}

export async function postProcessWavOnly(
  channels: Float32Array[],
  plan: CanonicalRenderPlan,
  profile: ExportProfile,
  phaseTimingsMs: ExportPhaseTimingsMs,
  signal?: AbortSignal,
): Promise<{ wavBytes: Uint8Array; phaseTimingsMs: ExportPhaseTimingsMs }> {
  const worker = getWorker();
  if (!worker) return runWavEncodeOnly(channels, plan, profile, phaseTimingsMs, signal);
  const jobId = nextJobId();
  const transferable = channels.map((channel) => channel.buffer as ArrayBuffer);
  const response = await runInWorker(
    worker,
    {
      type: "wavOnly",
      jobId,
      channels,
      plan,
      profile,
      phaseTimingsMs,
    },
    signal,
    transferable,
  );
  if (response.type !== "wavComplete") {
    throw new Error("Unexpected worker response for WAV-only export.");
  }
  return { wavBytes: response.wavBytes, phaseTimingsMs: response.phaseTimingsMs };
}

function runInWorker(
  worker: Worker,
  request: ExportPostProcessWorkerRequest,
  signal?: AbortSignal,
  transfer: Transferable[] = [],
): Promise<Extract<ExportPostProcessWorkerResponse, { type: "complete" | "wavComplete" }>> {
  return new Promise<ExportPostProcessWorkerResponse>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Export post-process cancelled", "AbortError"));
    };

    const onMessage = (event: MessageEvent<ExportPostProcessWorkerResponse>) => {
      if (event.data.jobId !== request.jobId) return;
      cleanup();
      if (event.data.type === "error") {
        reject(new Error(event.data.message));
        return;
      }
      resolve(event.data);
    };

    const onError = () => {
      cleanup();
      reject(new Error("Export post-process worker failed."));
    };

    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError, { once: true });
    worker.postMessage(request, transfer);
  }).then((response) => {
    if (response.type === "complete") return response;
    if (response.type === "wavComplete") return response;
    throw new Error("Unexpected worker response.");
  });
}
