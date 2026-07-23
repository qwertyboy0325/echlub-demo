import type { ExportPostProcessInput, ExportPostProcessResult } from "./exportPostProcessCore";
import { runExportPostProcess, runWavEncodeOnly } from "./exportPostProcessCore";

export type ExportPostProcessWorkerRequest =
  | { type: "evidence"; jobId: string; input: ExportPostProcessInput }
  | { type: "wavOnly"; jobId: string; channels: Float32Array[]; plan: ExportPostProcessInput["plan"]; profile: ExportPostProcessInput["profile"]; phaseTimingsMs: ExportPostProcessInput["phaseTimingsMs"] };

export type ExportPostProcessWorkerResponse =
  | { type: "complete"; jobId: string; result: ExportPostProcessResult }
  | { type: "wavComplete"; jobId: string; wavBytes: Uint8Array; phaseTimingsMs: ExportPostProcessInput["phaseTimingsMs"] }
  | { type: "error"; jobId: string; message: string };

self.onmessage = async (event: MessageEvent<ExportPostProcessWorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === "evidence") {
      const result = await runExportPostProcess(message.input);
      const response: ExportPostProcessWorkerResponse = {
        type: "complete",
        jobId: message.jobId,
        result,
      };
      self.postMessage(response);
      return;
    }

    const wavResult = await runWavEncodeOnly(
      message.channels,
      message.plan,
      message.profile,
      message.phaseTimingsMs,
    );
    const wavResponse: ExportPostProcessWorkerResponse = {
      type: "wavComplete",
      jobId: message.jobId,
      wavBytes: wavResult.wavBytes,
      phaseTimingsMs: wavResult.phaseTimingsMs,
    };
    self.postMessage(wavResponse);
  } catch (error) {
    const response: ExportPostProcessWorkerResponse = {
      type: "error",
      jobId: message.jobId,
      message: error instanceof Error ? error.message : "Export post-process failed.",
    };
    self.postMessage(response);
  }
};
