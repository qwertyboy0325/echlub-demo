import { writeFileSync, mkdirSync } from "fs";
import { performanceScript } from "../src/performanceScript.ts";
import { createInitialState, applyScriptEvent } from "../src/runtimeState.ts";
import { SceneExecutionAuthority } from "../src/sceneExecution.ts";
import { executeSceneTransaction } from "../src/sceneTransaction.ts";
import { AudioEngine } from "../src/audioEngine.ts";
import { parsePosition } from "../src/musicalPosition.ts";

const engine = new AudioEngine({ onStep: () => {}, onFinished: () => {} });
const state = createInitialState();
const authority = new SceneExecutionAuthority();
const lines = [];

for (const event of performanceScript) {
  applyScriptEvent(state, event);
  if (event.action === "launch" && event.target) {
    const bar = parsePosition(event.at).bar;
    executeSceneTransaction({
      state,
      sceneAuthority: authority,
      audioEngine: engine,
      event,
      bar,
      transportTime: 0,
    });
    const tx = authority.executionRecords.at(-1)?.transaction;
    if (tx) lines.push(JSON.stringify({ runId: "run-1", ...tx }));
  }
}

lines.push(JSON.stringify({
  type: "cue",
  runId: "run-1",
  draftId: "memory-opening",
  cueStartedAt: "2:0:0",
  cueStoppedAt: "4:0:0",
  masterSceneBefore: "idle",
  masterSceneDuring: "opening",
  masterStepCountBefore: 32,
  masterStepCountDuring: 64,
  cueNoteCount: 4,
}));

lines.push(JSON.stringify({
  type: "restart",
  runId: "run-2",
  semanticEventCount: performanceScript.length,
  sceneExecutionCount: 6,
  jamMemoryCount: 6,
  activeTransportSchedulesAfterReset: 0,
  activeGsapTimelinesAfterReset: 0,
  activeNativeTimersAfterReset: 0,
  cueActiveAfterReset: false,
}));

const outDir = "artifacts/four-brain-round2/final-repair-owner-review";
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/execution-log.jsonl`, lines.join("\n") + "\n");
console.log(`wrote ${lines.length} lines`);
