import * as Tone from "tone";
import type { ReconstructionPack } from "../domain/reconstructionPack";
import type { ProductionSession } from "../domain/sessionTypes";
import type { SessionMaterialBank } from "../domain/sessionMaterialBank";
import {
  renderCanonicalOfflineMaster,
  renderCanonicalWavOnly,
  type OfflineRenderProgress,
} from "./canonicalOfflineRenderer";
import { formatElapsedDuration } from "./exportPhaseTimings";
import {
  MASTER_EXPORT_PROFILE,
  QUICK_REVIEW_EXPORT_PROFILE,
  type ExportProfile,
} from "./exportProfiles";

export interface CanonicalExportContext {
  pack: ReconstructionPack;
  session?: ProductionSession;
  materialBank?: SessionMaterialBank;
}

export type ExportJobState =
  | { status: "idle" }
  | { status: "running"; label: string; progress: OfflineRenderProgress }
  | { status: "error"; message: string }
  | { status: "complete"; label: string };

export class OfflineExportController {
  private activeAbort: AbortController | null = null;
  private state: ExportJobState = { status: "idle" };
  private onStateChange: (state: ExportJobState) => void;
  private progressTicker: number | null = null;
  private exportStartedAt = 0;

  constructor(onStateChange: (state: ExportJobState) => void) {
    this.onStateChange = onStateChange;
  }

  getState(): ExportJobState {
    return this.state;
  }

  isBusy(): boolean {
    return this.state.status === "running";
  }

  cancel(): void {
    this.activeAbort?.abort();
  }

  async exportWav(context: CanonicalExportContext): Promise<void> {
    await this.runExport("Export Master WAV", MASTER_EXPORT_PROFILE, async (signal, onProgress) => {
      const result = await renderCanonicalWavOnly(context.pack, {
        session: context.session,
        materialBank: context.materialBank,
        exportProfile: MASTER_EXPORT_PROFILE,
        onProgress,
        signal,
      });
      await this.downloadWithTiming(
        result.wavBytes,
        `echlub-${sanitizeFilename(context.pack.metadata.id)}-master.wav`,
        "audio/wav",
        onProgress,
        signal,
      );
    });
  }

  async exportQuickReviewBundle(context: CanonicalExportContext): Promise<void> {
    await this.runExport("Export Quick Review", QUICK_REVIEW_EXPORT_PROFILE, async (signal, onProgress) => {
      const result = await renderCanonicalOfflineMaster(context.pack, {
        session: context.session,
        materialBank: context.materialBank,
        exportProfile: QUICK_REVIEW_EXPORT_PROFILE,
        onProgress,
        signal,
      });
      await this.downloadWithTiming(
        result.bundleZip,
        `echlub-${sanitizeFilename(context.pack.metadata.id)}-quick-review-evidence.zip`,
        "application/zip",
        onProgress,
        signal,
      );
    });
  }

  async exportEvidenceBundle(context: CanonicalExportContext): Promise<void> {
    await this.runExport("Export Master Evidence Bundle", MASTER_EXPORT_PROFILE, async (signal, onProgress) => {
      const result = await renderCanonicalOfflineMaster(context.pack, {
        session: context.session,
        materialBank: context.materialBank,
        exportProfile: MASTER_EXPORT_PROFILE,
        onProgress,
        signal,
      });
      await this.downloadWithTiming(
        result.bundleZip,
        `echlub-${sanitizeFilename(context.pack.metadata.id)}-render-evidence.zip`,
        "application/zip",
        onProgress,
        signal,
      );
    });
  }

  private async downloadWithTiming(
    bytes: Uint8Array,
    filename: string,
    mimeType: string,
    onProgress: (progress: OfflineRenderProgress) => void,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) throw new DOMException("Offline render cancelled", "AbortError");
    const baseElapsed = this.state.status === "running" ? this.state.progress.elapsedMs : 0;
    const downloadStart = performance.now();
    onProgress({
      phase: "downloadPreparation",
      elapsedMs: baseElapsed,
      phaseElapsedMs: 0,
    });
    downloadBytes(bytes, filename, mimeType);
    const downloadMs = performance.now() - downloadStart;
    onProgress({
      phase: "complete",
      elapsedMs: baseElapsed + downloadMs,
      phaseElapsedMs: downloadMs,
    });
  }

  private async runExport(
    label: string,
    _profile: ExportProfile,
    task: (signal: AbortSignal, onProgress: (progress: OfflineRenderProgress) => void) => Promise<void>,
  ): Promise<void> {
    if (this.isBusy()) {
      this.setState({ status: "error", message: "An export is already running." });
      return;
    }
    const abort = new AbortController();
    this.activeAbort = abort;
    this.setState({
      status: "running",
      label,
      progress: { phase: "planning", elapsedMs: 0, phaseElapsedMs: 0 },
    });
    this.startProgressTicker(label);
    try {
      await Tone.start();
      await task(abort.signal, (progress) => {
        this.setState({ status: "running", label, progress });
      });
      this.setState({ status: "complete", label });
    } catch (error) {
      if (abort.signal.aborted) {
        this.setState({ status: "idle" });
        return;
      }
      const message = error instanceof Error ? error.message : "Export failed.";
      this.setState({ status: "error", message });
    } finally {
      this.stopProgressTicker();
      this.activeAbort = null;
    }
  }

  private startProgressTicker(label: string): void {
    this.stopProgressTicker();
    this.exportStartedAt = performance.now();
    this.progressTicker = window.setInterval(() => {
      if (this.state.status !== "running") return;
      this.setState({
        status: "running",
        label,
        progress: {
          ...this.state.progress,
          elapsedMs: performance.now() - this.exportStartedAt,
        },
      });
    }, 1000);
  }

  private stopProgressTicker(): void {
    if (this.progressTicker !== null) {
      window.clearInterval(this.progressTicker);
      this.progressTicker = null;
    }
  }

  private setState(state: ExportJobState): void {
    this.state = state;
    this.onStateChange(state);
  }
}

function downloadBytes(bytes: Uint8Array, filename: string, mimeType: string): void {
  if (bytes.byteLength === 0) {
    throw new Error("Export produced an empty file.");
  }
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

const PHASE_LABELS: Record<OfflineRenderProgress["phase"], string> = {
  planning: "Planning render",
  graphInitialization: "Initializing graph",
  offlineRendering: "Rendering audio",
  wavEncoding: "Encoding WAV",
  audioAnalysis: "Computing diagnostics",
  hashing: "Hashing artifacts",
  zipPackaging: "Packaging bundle",
  downloadPreparation: "Preparing download",
  complete: "Complete",
};

export function formatExportProgress(state: ExportJobState): string {
  if (state.status === "idle") return "Ready";
  if (state.status === "error") return state.message;
  if (state.status === "complete") return `${state.label} complete`;
  const { progress } = state;
  const phaseLabel = PHASE_LABELS[progress.phase];
  const elapsed = formatElapsedDuration(progress.elapsedMs);
  const suffix = progress.offlineRenderNotCancellable && progress.phase === "offlineRendering"
    ? " (cannot cancel)"
    : "";
  return `${state.label}: ${phaseLabel} — ${elapsed} elapsed${suffix}`;
}
