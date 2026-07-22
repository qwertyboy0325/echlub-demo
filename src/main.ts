import "./style.css";
import * as Tone from "tone";
import { AudioEngine } from "./audioEngine";
import { stepsForEvent } from "./choreographyScript";
import { knobRotationForDelay, knobRotationForFilter } from "./mixMapping";
import { jamMemories } from "./performanceScript";
import { PresentationEngine } from "./presentation";
import { executeSceneTransaction } from "./sceneTransaction";
import { executionLog } from "./executionLog";
import { clearAllTimeouts, activeTimeoutCount } from "./timerRegistry";
import { parsePosition } from "./musicalPosition";
import { applyCollaborationEvent, createInitialState, resetState, updateBoundaryCountdown } from "./runtimeState";
import { RuntimeInstrumentation } from "./runtimeInstrumentation";
import {
  createIdleScene,
  IDLE_SCENE_ID,
  SceneExecutionAuthority,
  sceneById,
} from "./sceneExecution";
import type { BrainId, PerformanceScriptEvent, RuntimeState, SceneDefinition } from "./types";
import { DemoController, scheduleArrangementPlayback } from "./demo/demoController";
import { renderComparisonPanel, renderProductionRail, renderCanonicalStage, renderTopologyPanel } from "./demo/demoUi";
import { buildTopologyTransformation } from "./demo/canonicalPlayback";
import { enterAct, registerLiveSchedules } from "./demo/actScheduleRegistry";
import type { DemoAct } from "./domain/sessionTypes";
import { arrangementLaunchBoundaries } from "./demo/liveStructuralPlan";
import { importReconstructionPackFile } from "./domain/packLoader";

const brainMeta: Record<BrainId, { title: string; subtitle: string; symbol: string }> = {
  memory: { title: "Memory / Cue", subtitle: "phrases, fragments and private audition", symbol: "M" },
  pulse: { title: "Pulse / Timing", subtitle: "groove, quantization and musical gaps", symbol: "P" },
  blend: { title: "Blend / Space", subtitle: "filter, echo and attention", symbol: "B" },
  story: { title: "Story / Structure", subtitle: "scenes, extension, release and return", symbol: "S" },
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

const state: RuntimeState = createInitialState();
const presentation = new PresentationEngine();
const sceneAuthority = new SceneExecutionAuthority();
const instrumentation = new RuntimeInstrumentation();
let scriptIds: number[] = [];
let initialized = false;
let isPaused = false;
let lastCountdownLabel = "";
let runCycle = 1;
let canonicalPlaybackIds: number[] = [];
let demoMode: DemoAct | "idle" = "idle";
let comparisonHtml = "";

const audioEngine = new AudioEngine({
  onBeforeBoundary: (bar, time) => {
    if (demoMode !== "livePerformance") return;
    const result = demoController.applyLiveStructuralBoundary(bar, time);
    if (!result.applied.length) return;
    audioEngine.setTotalBars(demoController.runtime.session.arrangement.totalBars);
    audioEngine.setLaunchBoundaries(arrangementLaunchBoundaries(demoController.runtime.session));
    Tone.getDraw().schedule(() => {
      const description = result.applied.map((entry) => entry.description).join(" · ");
      const label = document.querySelector<HTMLElement>("#action-label");
      const detail = document.querySelector<HTMLElement>("#action-detail");
      const actor = document.querySelector<HTMLElement>("#action-actor");
      if (label) label.textContent = result.applied.map((entry) => entry.kind).join(" + ");
      if (detail) detail.textContent = description;
      if (actor) actor.textContent = "Story / Structure";
      updateTotalBarsUi();
      refreshProductionUi();
    }, time);
  },
  onStep: (bar, beat, sixteenth) => {
    state.currentBar = bar;
    state.currentBeat = beat;
    state.currentSixteenth = sixteenth;
    updateBoundaryCountdown(state);
    updateTransportUi();
    updateCountdownUi();
  },
  onFinished: () => finishPerformance(),
  onLaunchAtBar: (bar, sceneId, time) => {
    const event = currentLiveScript().find((e) => e.action === "launch" && e.target === sceneId);
    if (!event) return;
    demoController.applyLiveSceneMix(sceneId, event.id);
    const ok = executeSceneTransaction({
      state,
      sceneAuthority,
      audioEngine,
      event,
      bar,
      transportTime: time,
      resolveScene: (id) => demoController.runtime.session.scenes.find((s) => s.id === id),
      authoritativeMix: demoController.runtime.session.mix,
    });
    if (!ok) return;
    const scene = demoController.runtime.session.scenes.find((s) => s.id === sceneId);
    instrumentation.logSceneExecution(
      sceneAuthority.executionRecords[sceneAuthority.executionRecords.length - 1],
    );
    Tone.getDraw().schedule(() => projectSceneLaunchUi(event, scene), time);
  },
  onCueComplete: (evidence) => {
    executionLog.logCue({
      runId: executionLog.run,
      ...evidence,
    });
  },
});

audioEngine.bindSceneAuthority(sceneAuthority);

const demoController = new DemoController({
  getState: () => state,
  refreshUi: () => { refreshWorkspaces(); updateAllUi(); updateTransportUi(); },
  refreshProductionUi,
  audioEngine,
  clearTransportSchedules: (ids) => {
    if (initialized) audioEngine.clearScript(ids);
    const transport = Tone.getTransport();
    canonicalPlaybackIds.forEach((id) => transport.clear(id));
    canonicalPlaybackIds = [];
    scriptIds.forEach((id) => transport.clear(id));
    scriptIds = [];
  },
  onProductionAction: (label, participantId) => {
    const participant = demoController.runtime.session.participants.find((p) => p.id === participantId);
    const labelEl = document.querySelector<HTMLElement>("#action-label");
    const detail = document.querySelector<HTMLElement>("#action-detail");
    if (labelEl) labelEl.textContent = label;
    if (detail) detail.textContent = `${participant?.displayName ?? "Creator"}: ${label}`;
    demoController.director.applyDomFocus(app!);
  },
  onActChange: (act) => {
    demoMode = act;
    app!.querySelector(".app-shell")?.setAttribute("data-act", act);
    refreshProductionUi();
  },
  runLivePerformance: () => { void runLivePerformanceAct(); },
  showComparison: (summary) => {
    comparisonHtml = renderComparisonPanel(summary);
    const slot = document.querySelector("#comparison-slot");
    if (slot) slot.innerHTML = comparisonHtml;
    demoMode = "comparison";
    refreshProductionUi();
  },
  scheduleCanonicalPlayback: (onDone) => { void runCanonicalPlaybackAct(onDone); },
});
audioEngine.setBaseBpm(demoController.runtime.pack.metadata.bpm);
audioEngine.setTotalBars(demoController.runtime.session.arrangement.totalBars);

function currentLiveScript(): readonly PerformanceScriptEvent[] {
  return demoController.runtime.pack.livePerformanceChoreography;
}

function render(): void {
  const idleScene = createIdleScene();
  const displayScene = sceneById(state.activeSceneId) ?? idleScene;
  app!.innerHTML = `
  <main class="app-shell ${state.recordingMode ? "recording-mode" : ""}" data-act="${demoMode}">
    <header class="topbar glass">
      <div class="brand-block">
        <div class="brand-mark">E</div>
        <div>
          <div class="eyebrow">ROUND 3 · production → song → performance</div>
          <h1>EchLub Concept Film Runtime</h1>
          <p>Virtual creators build materials, assemble a canonical song, then reopen it for live recomposition.</p>
        </div>
      </div>
      <div class="header-status">
        <span class="pill" id="bpm-label">${demoController.runtime.pack.metadata.bpm} BPM</span>
        <span class="pill" id="total-bars-label">${demoController.runtime.session.arrangement.totalBars} bars</span>
        <span class="pill" id="pack-label">${demoController.runtime.pack.metadata.title}</span>
        <span class="pill">prototype only</span>
        <span class="pill status-ready" id="audio-status">audio locked</span>
      </div>
    </header>

    <div id="production-slot"></div>
    <div id="comparison-slot">${comparisonHtml}</div>

    <section class="demo-controls glass">
      <div class="transport-controls">
        <button class="button primary" id="start-button">Start full demo</button>
        <button class="button" id="pause-button" disabled>Pause</button>
        <button class="button" id="restart-button" disabled>Restart</button>
        <button class="button" id="record-mode-button">Recording mode</button>
      </div>
      <div class="skip-controls">
        <button class="button mini" id="skip-production">Skip to Production</button>
        <button class="button mini" id="skip-playback">Skip to Canonical Playback</button>
        <button class="button mini" id="skip-performance">Skip to Live Performance</button>
        <label class="speed-control">Speed <input type="range" id="speed-control" min="1" max="8" value="1" /></label>
        <label class="pack-import">Local pack <input type="file" id="pack-file-input" accept="application/json,.json" /></label>
        <span class="pack-import-status" id="pack-import-status">validated placeholder</span>
      </div>
    </section>

    <section class="master-stage glass">
      <div class="master-copy">
        <div class="eyebrow">MASTER OUTPUT</div>
        <h2 id="scene-title">${displayScene.title}</h2>
        <p id="scene-description">${displayScene.description}</p>
        <div class="boundary-countdown" id="boundary-countdown" data-phase="idle">
          <span class="boundary-label" id="boundary-label">—</span>
          <span class="boundary-ticks" id="boundary-ticks"></span>
        </div>
      </div>
      <div class="transport-controls performance-only">
        <button class="button primary" id="live-only-button">Live performance only</button>
      </div>
      <div class="transport-readout">
        <div><span>Position</span><strong id="position">01 · 1 · 1</strong></div>
        <div><span>Next phrase</span><strong id="next-scene">Groove Established</strong></div>
        <div><span>Queued</span><strong id="queue-count">0 decisions</strong></div>
        <div><span>Provenance</span><strong id="provenance-label">—</strong></div>
      </div>
      <div class="step-grid" id="master-grid">
        ${Array.from({ length: 16 }, (_, i) => `<i data-master-step="${i}"></i>`).join("")}
      </div>
      <div class="scene-timeline">
        ${demoController.runtime.session.scenes.map((s) => `<article class="scene-card ${s.id === state.activeSceneId ? "active" : ""} ${state.queue.some((q) => q.sceneId === s.id && q.status === "queued") ? "queued" : ""}" data-scene="${s.id}"><span>${String(s.startBar + 1).padStart(2, "0")}</span><strong>${s.title}</strong><small>${s.bars} bars</small></article>`).join("")}
      </div>
    </section>

    <section class="brain-grid">
      ${(["memory", "pulse", "blend", "story"] as BrainId[]).map(renderBrainWindow).join("")}
    </section>

    <section class="bottom-grid">
      <article class="glass action-monitor">
        <div class="section-heading"><div><span class="eyebrow">SEMANTIC ACTION</span><h3 id="action-label">No action yet</h3></div><span class="action-actor" id="action-actor">—</span></div>
        <p id="action-detail">Press Start to let the four scripted brains build and perform the arrangement.</p>
        <div class="pipeline">
          <span data-state="editing">Editing</span><b>→</b>
          <span data-state="preview">Private preview</span><b>→</b>
          <span data-state="offered">Offered</span><b>→</b>
          <span data-state="queued">Queued</span><b>→</b>
          <span data-state="playing">Playing</span>
        </div>
      </article>
      <article class="glass jam-memory">
        <div class="section-heading"><div><span class="eyebrow">JAM MEMORY</span><h3>Captured structural moments</h3></div><span id="memory-count">0 / ${jamMemories.length}</span></div>
        <div class="memory-list" id="memory-list">
          ${jamMemories.map((m) => `<button data-memory="${m.id}" disabled><span>${m.at.split(":")[0]}</span><strong>${m.title}</strong><small>${m.description}</small></button>`).join("")}
        </div>
      </article>
    </section>
    <footer class="demo-footer">Round 3 prototype — production, canonical playback, and live recomposition share one data model. Placeholder music only; not 四季ノ唄.</footer>
  </main>`;
  bindControls();
  presentation.initialize();
  presentation.reset();
  refreshProductionUi();
  updateAllUi();
}

function refreshProductionUi(): void {
  const slot = document.querySelector("#production-slot");
  if (!slot) return;
  const showProduction = demoMode === "production" || demoMode === "idle";
  const showCanonical = demoMode === "canonicalPlayback";
  if (showProduction) {
    slot.innerHTML = renderProductionRail(demoController.runtime.session, demoController.director);
  } else if (showCanonical) {
    slot.innerHTML = `${renderTopologyPanel(demoController.runtime.session)}${renderCanonicalStage(demoController.runtime.session, state.currentBar)}`;
  } else {
    slot.innerHTML = renderTopologyPanel(demoController.runtime.session);
  }
  demoController.director.applyDomFocus(app!);
}

function renderBrainWindow(brain: BrainId): string {
  const meta = brainMeta[brain];
  return `
    <article class="brain-window glass" data-brain="${brain}">
      <div class="brain-header">
        <div class="brain-id">${meta.symbol}</div>
        <div><span class="eyebrow">BRAIN ${meta.symbol}</span><h3>${meta.title}</h3><p>${meta.subtitle}</p></div>
        <span class="brain-state" id="${brain}-state">idle</span>
      </div>
      <div class="brain-workspace">${renderWorkspace(brain)}</div>
      <div class="thought-strip"><span>thinking</span><p id="${brain}-thought">${state.thoughts[brain]}</p></div>
      <div class="virtual-cursor" data-cursor="${brain}"><i></i><b>${meta.symbol}</b></div>
    </article>`;
}

function renderWorkspace(brain: BrainId): string {
  if (brain === "memory") return renderMemoryWorkspace();
  if (brain === "pulse") return renderPulseWorkspace();
  if (brain === "blend") return renderBlendWorkspace();
  return renderStoryWorkspace();
}

function renderMemoryWorkspace(): string {
  const draft = state.drafts[state.activeDraftId];
  const tabs = ["memory-opening", "memory-main", "memory-response"].map((id) => {
    const d = state.drafts[id];
    return `<button class="mini ${id === state.activeDraftId ? "active" : ""} status-${d.status}" data-draft-tab="${id}" data-target="${id}">${d.title}</button>`;
  }).join("");
  const notes = (draft?.notes ?? []).map((n) =>
    `<div class="piano-note status-${draft?.status ?? "editing"}" data-note-id="${n.id}" style="--step:${n.step};--pitch:${n.pitch}"><span>${n.note}</span></div>`,
  ).join("");
  return `
    <div class="workspace-toolbar">${tabs}</div>
    <div class="piano-roll brain-primary-target ${state.previewBrain === "memory" ? "private-preview" : ""}" data-target="memory-grid">
      <div class="piano-grid">${notes}</div>
    </div>
    <div class="workspace-actions">
      <button data-target="private-cue" class="${state.previewBrain === "memory" ? "active-preview" : ""}">Private cue</button>
      <button data-target="offer-memory">Offer phrase</button>
    </div>`;
}

function renderPulseWorkspace(): string {
  const pattern = state.drafts[state.activePatternId];
  const tabs = ["pulse-sparse", "pulse-full", "pulse-break"].map((id) => {
    const d = state.drafts[id];
    return `<button class="mini ${id === state.activePatternId ? "active" : ""} status-${d.status}" data-draft-tab="${id}">${d.title}</button>`;
  }).join("");
  const steps = pattern?.steps ?? [];
  const rows = ["Kick", "Snare", "Hat"].map((name, row) => {
    return `<div class="seq-row"><span>${name}</span>${Array.from({ length: 16 }, (_, s) => {
      const on = row === 0 ? steps.includes(s) : row === 1 ? (s === 4 || s === 12) : s % 2 === 0 && steps.includes(s);
      const id = `seq-${pattern?.id ?? "pulse"}-${s}`;
      return `<i class="${on ? "on" : ""}" data-seq-id="${id}" data-seq-step="${row}-${s}"></i>`;
    }).join("")}</div>`;
  }).join("");
  return `
    <div class="workspace-toolbar">${tabs}</div>
    <div class="sequencer brain-primary-target ${state.previewBrain === "pulse" ? "private-preview" : ""}" data-target="pulse-grid">${rows}</div>
    <div class="workspace-actions">
      <button data-target="private-cue" class="${state.previewBrain === "pulse" ? "active-preview" : ""}">Private cue</button>
      <button data-target="quantize">Quantize 1/16</button>
      <button data-target="offer-pulse">Offer timing</button>
    </div>`;
}

function renderBlendWorkspace(): string {
  const faders = state.mix.faders;
  const channels = [
    { key: "groove", label: "Groove" },
    { key: "harmony", label: "Harmony" },
    { key: "melody", label: "Melody" },
    { key: "texture", label: "Texture" },
  ];
  const filterRot = knobRotationForFilter(state.mix.filter);
  const delayRot = knobRotationForDelay(state.mix.delayWet);
  const releaseRot = knobRotationForFilter(Math.max(state.mix.filter, 2800));
  const warmRot = knobRotationForFilter(Math.min(state.mix.filter, 1600));
  return `
    <div class="mixer brain-primary-target">
      ${channels.map((ch) => `<div class="channel"><strong>${ch.label}</strong>
        <div class="fader" data-fader="${ch.key}" id="fader-${ch.key}"><i style="height:${faders[ch.key]}%"></i><b class="fader-thumb" style="bottom:${faders[ch.key]}%"></b></div>
        <span>${Math.round(-24 + faders[ch.key] * 0.2)} dB</span></div>`).join("")}
    </div>
    <div class="fx-row">
      <label data-target="blend-filtered" id="filter-knob-wrap"><span>Filter</span><i><b class="knob" id="filter-knob" style="transform:rotate(${filterRot}deg)"></b></i><small>${Math.round(state.mix.filter)} Hz</small></label>
      <label data-target="blend-warm"><span>Warm</span><i><b class="knob" style="transform:rotate(${warmRot}deg)"></b></i><small>low-mid</small></label>
      <label data-target="blend-release"><span>Release</span><i><b class="knob" style="transform:rotate(${releaseRot}deg)"></b></i><small>wide</small></label>
      <label data-target="delay-send" id="delay-knob-wrap"><span>Echo</span><i><b class="knob" id="delay-knob" style="transform:rotate(${delayRot}deg)"></b></i><small>${Math.round(state.mix.delayWet * 100)}%</small></label>
    </div>`;
}

function renderStoryWorkspace(): string {
  const playingItems = state.queue.filter((q) => q.status === "playing").map((q) =>
    `<div class="queue-item status-playing" data-queue-id="${q.id}" data-target="${q.id}"><span>${q.label}</span><small>Playing · Bar ${q.executeAtBar + 1}</small></div>`,
  ).join("");
  const queueItems = state.queue.filter((q) => q.status === "queued").map((q) =>
    `<div class="queue-item status-queued" data-queue-id="${q.id}" data-target="${q.id}"><span>${q.label}</span><small>Bar ${q.executeAtBar + 1}</small></div>`,
  ).join("");
  const offered = state.offeredDrafts.map((id) => {
    const d = state.drafts[id];
    return `<div class="offered-draft status-offered" data-target="${id}"><span>${d?.title ?? id}</span><small>offered</small></div>`;
  }).join("");
  const sceneButtons = demoController.runtime.session.scenes.map((s) => {
    const queued = state.queue.some((q) => q.sceneId === s.id && q.status === "queued");
    const playing = state.queue.some((q) => q.sceneId === s.id && q.status === "playing") || s.id === state.activeSceneId;
    return `<button class="${playing ? "playing" : ""} ${queued ? "queued" : ""}" data-target="${s.id}" data-story-scene="${s.id}"><span>${String(s.startBar + 1).padStart(2, "0")}</span><strong>${s.title}</strong><small>${queued ? "queued" : playing ? "playing" : `${s.bars} bars`}</small></button>`;
  }).join("");
  return `
    <div class="story-layout">
      <div class="offered-tray"><span class="tray-label">Offered</span>${offered || '<em class="empty">—</em>'}</div>
      <div class="shared-queue brain-primary-target" data-target="shared-queue"><span class="tray-label">Shared Queue</span>${playingItems}${queueItems || (!playingItems ? '<em class="empty">—</em>' : "")}</div>
      <div class="arrangement">${sceneButtons}</div>
    </div>
    <div class="workspace-actions"><button data-target="hold-scene">Hold 4 bars</button><button data-target="commit-scene">Commit scene</button></div>`;
}

function bindControls(): void {
  getButton("#start-button").addEventListener("click", onStart);
  getButton("#pause-button").addEventListener("click", onPause);
  getButton("#restart-button").addEventListener("click", onRestart);
  getButton("#record-mode-button").addEventListener("click", onToggleRecording);
  document.querySelector("#skip-production")?.addEventListener("click", () => onSkipAct("production"));
  document.querySelector("#skip-playback")?.addEventListener("click", () => onSkipAct("canonicalPlayback"));
  document.querySelector("#skip-performance")?.addEventListener("click", () => onSkipAct("livePerformance"));
  document.querySelector("#live-only-button")?.addEventListener("click", () => onSkipAct("livePerformance"));
  document.querySelector<HTMLInputElement>("#speed-control")?.addEventListener("input", (e) => {
    const val = Number((e.target as HTMLInputElement).value);
    demoController.setSpeed(val);
    audioEngine.setTempoMultiplier(val);
  });
  document.querySelector<HTMLInputElement>("#pack-file-input")?.addEventListener("change", (event) => {
    void onImportPack(event);
  });
}

async function onImportPack(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const status = document.querySelector<HTMLElement>("#pack-import-status");
  const file = input.files?.[0];
  if (!file) return;
  if (initialized) {
    if (status) status.textContent = "Restart page before changing packs";
    input.value = "";
    return;
  }
  if (status) status.textContent = "validating locally…";
  try {
    const pack = await importReconstructionPackFile(file);
    demoController.loadPack(pack);
    audioEngine.setBaseBpm(pack.metadata.bpm);
    audioEngine.setTotalBars(pack.arrangement.totalBars);
    window.__echlubExpectedScriptScheduleCount = pack.livePerformanceChoreography.length;
    render();
    const nextStatus = document.querySelector<HTMLElement>("#pack-import-status");
    if (nextStatus) nextStatus.textContent = `local only · ${pack.metadata.source}`;
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : String(error);
    input.value = "";
  }
}

async function onSkipAct(act: DemoAct): Promise<void> {
  if (!initialized) {
    getButton("#start-button").disabled = true;
    getButton("#start-button").textContent = "Preparing audio…";
    await audioEngine.initialize();
    initialized = true;
    const status = document.querySelector<HTMLElement>("#audio-status");
    if (status) { status.textContent = "audio ready"; status.classList.add("live"); }
  }
  demoController.stop();
  if (act === "canonicalPlayback" || act === "livePerformance") {
    demoController.runtime.completeProductionInstantly();
  }
  demoController.skipToAct(act);
  if (act === "canonicalPlayback") {
    resetRuntime();
    demoController.syncSessionToState();
    await runCanonicalPlaybackAct(() => {
      getButton("#start-button").textContent = "Canonical playback complete";
      getButton("#start-button").disabled = false;
    });
  } else if (act === "livePerformance") {
    resetRuntime();
    demoController.syncSessionToState();
    await runLivePerformanceAct();
  } else {
    resetRuntime();
    demoController.syncSessionToState();
    refreshProductionUi();
    refreshWorkspaces();
    updateAllUi();
    getButton("#start-button").textContent = "Start full demo";
    getButton("#start-button").disabled = false;
  }
  getButton("#pause-button").disabled = false;
  getButton("#restart-button").disabled = false;
}

async function onStart(): Promise<void> {
  if (!initialized) {
    getButton("#start-button").disabled = true;
    getButton("#start-button").textContent = "Preparing audio…";
    await audioEngine.initialize();
    initialized = true;
    const status = document.querySelector<HTMLElement>("#audio-status");
    if (status) { status.textContent = "audio ready"; status.classList.add("live"); }
  }
  const packInput = document.querySelector<HTMLInputElement>("#pack-file-input");
  if (packInput) packInput.disabled = true;
  resetRuntime();
  isPaused = false;
  getButton("#start-button").textContent = "Running full demo…";
  getButton("#start-button").disabled = true;
  getButton("#pause-button").disabled = false;
  getButton("#restart-button").disabled = false;
  await demoController.startFullDemo();
}

function onPause(): void {
  if (!initialized) return;
  if (demoController.isRunning() && demoController.runtime.act === "production") {
    demoController.pause();
    getButton("#pause-button").textContent = demoController.isPaused() ? "Resume" : "Pause";
    return;
  }
  if (isPaused) {
    audioEngine.resume();
    getButton("#pause-button").textContent = "Pause";
    getButton("#start-button").textContent = demoMode === "livePerformance" ? "Running live performance" : "Running full demo…";
  } else {
    audioEngine.pause();
    getButton("#pause-button").textContent = "Resume";
    getButton("#start-button").textContent = "Demo paused";
  }
  isPaused = !isPaused;
}

async function onRestart(): Promise<void> {
  if (!initialized) return;
  const restartingAct = demoMode;
  demoController.stop();
  resetRuntime();
  if (restartingAct === "canonicalPlayback") {
    demoController.restart();
    demoController.syncSessionToState();
    await runCanonicalPlaybackAct(() => {
      getButton("#start-button").textContent = "Canonical playback complete";
      getButton("#start-button").disabled = false;
    });
  } else if (restartingAct === "livePerformance") {
    await runLivePerformanceAct();
  } else {
    await demoController.startFullDemo();
  }
  isPaused = false;
  getButton("#pause-button").textContent = "Pause";
  getButton("#start-button").textContent = demoMode === "livePerformance"
    ? "Running live performance"
    : demoMode === "canonicalPlayback"
      ? "Running canonical playback"
      : "Running full demo…";
  getButton("#start-button").disabled = true;
}

function onToggleRecording(): void {
  state.recordingMode = !state.recordingMode;
  app!.querySelector(".app-shell")?.classList.toggle("recording-mode", state.recordingMode);
  getButton("#record-mode-button").textContent = state.recordingMode ? "Exit recording mode" : "Recording mode";
}

function scheduleScript(): void {
  if (demoMode !== "livePerformance") return;
  const transport = Tone.getTransport();
  scriptIds.forEach((id) => transport.clear(id));
  scriptIds = [];
  audioEngine.setLaunchBoundaries(arrangementLaunchBoundaries(demoController.runtime.session));
  for (const event of currentLiveScript()) {
    const id = transport.schedule((time: number) => {
      demoController.applyLiveMusicalEvent(event, time);
      if (event.action === "preview" && event.target) {
        const ref = demoController.runtime.getMaterialRefForDraft(event.target);
        if (ref) audioEngine.startPrivateCue(ref, parsePosition(event.at));
      }
      if (event.action !== "launch") {
        applyCollaborationEvent(state, event, currentLiveScript());
      }
      Tone.getDraw().schedule(() => projectScriptEventUi(event), time);
    }, event.at);
    scriptIds.push(id);
  }
  registerLiveSchedules(demoController.runtime.scheduleRegistry, scriptIds);
  instrumentation.setScheduleCount(scriptIds.length);
}

function projectScriptEventUi(event: PerformanceScriptEvent): void {
  instrumentation.logEvent(event);
  updateActionUi(event);

  if (event.action === "preview") {
    presentation.markPreview(event.brain);
  }
  if (event.action === "launch" && event.target) {
    instrumentation.setGsapTweenCount(presentation.getActiveTimelineCount());
    return;
  }

  const steps = stepsForEvent(event.id);
  if (steps.length) presentation.executeSteps(steps);
  refreshWorkspaces();
  updateAllUi();
  instrumentation.setGsapTweenCount(presentation.getActiveTimelineCount());
}

function projectSceneLaunchUi(event: PerformanceScriptEvent, scene?: SceneDefinition): void {
  if (!scene) return;
  updateMasterSceneUi(scene);
  presentation.clearPreview();
  presentation.flashMaster();
  presentation.showBoundaryPulse("Executed");
  presentation.pulseScene(scene.id);
  const steps = stepsForEvent(event.id);
  if (steps.length) presentation.executeSteps(steps);
  refreshWorkspaces();
  updateJamMemoryUi();
  updateAllUi();
  instrumentation.setGsapTweenCount(presentation.getActiveTimelineCount());
}

function updateMasterSceneUi(scene: SceneDefinition): void {
  state.activeSceneId = scene.id;
  document.querySelectorAll(".scene-card").forEach((el) => {
    const id = el.getAttribute("data-scene");
    el.classList.toggle("active", id === scene.id);
    el.classList.toggle("queued", state.queue.some((q) => q.sceneId === id && q.status === "queued"));
  });
  const title = document.querySelector<HTMLElement>("#scene-title");
  const desc = document.querySelector<HTMLElement>("#scene-description");
  if (title) title.textContent = scene.title;
  if (desc) desc.textContent = scene.description;
  const sessionScenes = demoController.runtime.session.scenes;
  const idx = sessionScenes.findIndex((s) => s.id === scene.id);
  const next = document.querySelector<HTMLElement>("#next-scene");
  if (next) next.textContent = sessionScenes[idx + 1]?.title ?? "Ending silence";
}

function updateCountdownUi(): void {
  const cd = state.boundaryCountdown;
  const labelEl = document.querySelector<HTMLElement>("#boundary-label");
  const ticksEl = document.querySelector<HTMLElement>("#boundary-ticks");
  if (!labelEl || !ticksEl) return;
  if (!cd) {
    labelEl.textContent = "—";
    ticksEl.textContent = "";
    return;
  }
  labelEl.textContent = cd.boundaryId || cd.label;
  if (cd.barsRemaining === 0 && cd.beatsRemaining > 0 && cd.beatsRemaining <= 4) {
    const tick = ["4", "3", "2", "1"][cd.beatsRemaining - 1] ?? "";
    ticksEl.textContent = tick ? `${tick}…` : "Executed";
    if (tick && tick !== lastCountdownLabel) {
      lastCountdownLabel = tick;
      presentation.showBoundaryPulse(tick);
    }
  } else if (cd.barsRemaining > 0) {
    ticksEl.textContent = `${cd.barsRemaining} bar${cd.barsRemaining > 1 ? "s" : ""}`;
  } else {
    ticksEl.textContent = "";
  }
}

function updateTransportUi(): void {
  const step = state.currentBeat * 4 + state.currentSixteenth;
  document.querySelectorAll("[data-master-step]").forEach((el, i) => el.classList.toggle("active", i === step));
  const pos = document.querySelector<HTMLElement>("#position");
  if (pos) pos.textContent = `${String(state.currentBar + 1).padStart(2, "0")} · ${state.currentBeat + 1} · ${state.currentSixteenth + 1}`;
  const progress = Math.min(100, ((state.currentBar * 16 + step) / (audioEngine.getTotalBars() * 16)) * 100);
  document.documentElement.style.setProperty("--song-progress", `${progress}%`);
}

function updateTotalBarsUi(): void {
  const label = document.querySelector<HTMLElement>("#total-bars-label");
  if (label) label.textContent = `${audioEngine.getTotalBars()} bars`;
}

function updateActionUi(event: PerformanceScriptEvent): void {
  const label = document.querySelector<HTMLElement>("#action-label");
  const detail = document.querySelector<HTMLElement>("#action-detail");
  const actor = document.querySelector<HTMLElement>("#action-actor");
  if (label) label.textContent = event.label;
  if (detail) detail.textContent = event.detail;
  if (actor) actor.textContent = brainMeta[event.brain].title;
  document.querySelector<HTMLElement>(`#${event.brain}-thought`)!.textContent = event.detail;
  document.querySelectorAll(".brain-state").forEach((el) => { el.textContent = "observing"; });
  document.querySelector<HTMLElement>(`#${event.brain}-state`)!.textContent = event.action;
  document.querySelectorAll(".pipeline span").forEach((el) => {
    const st = el.getAttribute("data-state");
    el.classList.toggle("pipeline-active", st === mapActionToPipeline(event.action));
  });
}

function mapActionToPipeline(action: string): string {
  const map: Record<string, string> = { edit: "editing", preview: "preview", offer: "offered", queue: "queued", launch: "playing", dragToQueue: "queued", ready: "ready" };
  return map[action] ?? "";
}

function refreshWorkspaces(): void {
  (["memory", "pulse", "blend", "story"] as BrainId[]).forEach((brain) => {
    const ws = document.querySelector(`[data-brain="${brain}"] .brain-workspace`);
    if (ws) ws.innerHTML = renderWorkspace(brain);
  });
}

function updateAllUi(): void {
  const qc = document.querySelector<HTMLElement>("#queue-count");
  if (qc) qc.textContent = `${state.queue.filter((q) => q.status === "queued").length} decision${state.queue.length === 1 ? "" : "s"}`;
  updateCountdownUi();
}

function updateJamMemoryUi(): void {
  jamMemories.forEach((memory) => {
    const captured = state.history.some((h) => h.id === memory.id);
    const btn = document.querySelector<HTMLButtonElement>(`[data-memory="${memory.id}"]`);
    if (btn && captured) {
      btn.disabled = false;
      btn.classList.add("captured");
    }
  });
  const mc = document.querySelector<HTMLElement>("#memory-count");
  if (mc) mc.textContent = `${state.history.length} / ${jamMemories.length}`;
}

function buildRestartPhaseRecord(
  phase: import("./executionLog").RestartPhase,
  runId: string,
  overrides: Partial<import("./executionLog").RestartPhaseRecord> = {},
): import("./executionLog").RestartPhaseRecord {
  return {
    phase,
    runId,
    semanticEventCount: currentLiveScript().length,
    transportScriptSchedules: overrides.transportScriptSchedules ?? scriptIds.length,
    cueSchedules: overrides.cueSchedules ?? audioEngine.getCueScheduleCount(),
    registeredNativeTimers: overrides.registeredNativeTimers ?? activeTimeoutCount(),
    activeGsapTimelines: overrides.activeGsapTimelines ?? presentation.getActiveTimelineCount(),
    cueActive: overrides.cueActive ?? audioEngine.isCueActive(),
    queueEmpty: overrides.queueEmpty ?? state.queue.length === 0,
    jamMemoryEmpty: overrides.jamMemoryEmpty ?? state.history.length === 0,
    sceneAuthorityEmpty: overrides.sceneAuthorityEmpty ?? sceneAuthority.executionRecords.length === 0,
  };
}

function resetRuntime(): void {
  const runId = `run-${runCycle}`;
  executionLog.logRestartPhase(buildRestartPhaseRecord("beforeClear", runId));

  presentation.reset();
  clearAllTimeouts();
  sceneAuthority.reset();
  instrumentation.reset();
  resetState(state);
  state.activeSceneId = IDLE_SCENE_ID;
  lastCountdownLabel = "";
  if (initialized) {
    audioEngine.stop();
    audioEngine.resetAudioState();
    audioEngine.resetPrivateCue();
    audioEngine.clearScript(scriptIds);
    scriptIds = [];
    const transport = Tone.getTransport();
    canonicalPlaybackIds.forEach((id) => transport.clear(id));
    canonicalPlaybackIds = [];
  }

  executionLog.logRestartPhase(buildRestartPhaseRecord("afterClear", runId, {
    transportScriptSchedules: scriptIds.length,
    cueSchedules: audioEngine.getCueScheduleCount(),
    registeredNativeTimers: activeTimeoutCount(),
    activeGsapTimelines: presentation.getActiveTimelineCount(),
    cueActive: audioEngine.isCueActive(),
    queueEmpty: state.queue.length === 0,
    jamMemoryEmpty: state.history.length === 0,
    sceneAuthorityEmpty: sceneAuthority.executionRecords.length === 0,
  }));

  if (initialized && demoMode === "livePerformance") {
    scheduleScript();
  }

  executionLog.logRestartPhase(buildRestartPhaseRecord("afterReschedule", runId, {
    transportScriptSchedules: scriptIds.length,
    queueEmpty: state.queue.length === 0,
    jamMemoryEmpty: state.history.length === 0,
    sceneAuthorityEmpty: sceneAuthority.executionRecords.length === 0,
  }));

  runCycle += 1;
  executionLog.setRunId(`run-${runCycle}`);
  updateMasterSceneUi(createIdleScene());
  refreshWorkspaces();
  updateAllUi();
  updateTransportUi();
  const label = document.querySelector<HTMLElement>("#action-label");
  const detail = document.querySelector<HTMLElement>("#action-detail");
  if (label) label.textContent = "Performance started";
  if (detail) detail.textContent = "The four scripted brains are preparing their private drafts.";
}

function finishPerformance(): void {
  if (demoMode === "canonicalPlayback") return;
  updateJamMemoryUi();
  if (demoMode === "livePerformance") {
    const liveScenes = sceneAuthority.executionRecords.map((r) => r.sceneId);
    demoController.onLivePerformanceFinished(liveScenes, state.history.length);
    getButton("#start-button").textContent = "Live take complete";
  } else {
    getButton("#start-button").textContent = "Performance complete";
  }
  getButton("#start-button").disabled = false;
  getButton("#pause-button").disabled = true;
}

async function runLivePerformanceAct(): Promise<void> {
  demoMode = "livePerformance";
  enterAct(demoController.runtime.scheduleRegistry, "livePerformance", (ids) => audioEngine.clearScript(ids));
  demoController.runtime.beginLivePerformance();
  demoController.syncSessionToState();
  audioEngine.setMaterialBank(demoController.runtime.materialBank);
  audioEngine.setBaselineMix(demoController.runtime.syncRuntimeMix());
  audioEngine.setCurrentAct("livePerformance");
  audioEngine.setTotalBars(demoController.runtime.session.arrangement.totalBars);
  audioEngine.setLaunchBoundaries(arrangementLaunchBoundaries(demoController.runtime.session));
  updateTotalBarsUi();
  refreshProductionUi();
  resetRuntimeForLive();
  audioEngine.start();
  isPaused = false;
  getButton("#start-button").textContent = "Running live performance";
  getButton("#start-button").disabled = true;
  getButton("#pause-button").disabled = false;
  getButton("#restart-button").disabled = false;
}

function resetRuntimeForLive(): void {
  presentation.reset();
  clearAllTimeouts();
  sceneAuthority.reset();
  instrumentation.reset();
  resetState(state);
  state.activeSceneId = IDLE_SCENE_ID;
  lastCountdownLabel = "";
  if (initialized) {
    audioEngine.stop();
    audioEngine.resetAudioState();
    audioEngine.resetPrivateCue();
    audioEngine.clearScript(scriptIds);
    scriptIds = [];
    const transport = Tone.getTransport();
    canonicalPlaybackIds.forEach((id) => transport.clear(id));
    canonicalPlaybackIds = [];
    scheduleScript();
  }
  demoController.syncSessionToState();
  updateMasterSceneUi(createIdleScene());
  refreshWorkspaces();
  updateAllUi();
  updateTransportUi();
}

async function runCanonicalPlaybackAct(onDone: () => void): Promise<void> {
  demoMode = "canonicalPlayback";
  enterAct(demoController.runtime.scheduleRegistry, "canonicalPlayback", (ids) => audioEngine.clearScript(ids));
  const session = demoController.runtime.session;
  const transport = Tone.getTransport();
  canonicalPlaybackIds.forEach((id) => transport.clear(id));
  canonicalPlaybackIds = [];
  audioEngine.stop();
  audioEngine.resetAudioState();
  audioEngine.clearScript(scriptIds);
  scriptIds = [];
  audioEngine.setMaterialBank(demoController.runtime.materialBank);
  audioEngine.setBaselineMix(demoController.runtime.syncRuntimeMix());
  audioEngine.setCurrentAct("canonicalPlayback");
  audioEngine.setTotalBars(session.arrangement.totalBars);
  updateTotalBarsUi();
  audioEngine.clearLaunchBoundaries();

  const sceneRefs = session.arrangement.scenes.map((ref) => ({
    scene: session.scenes.find((s) => s.id === ref.sceneId)!,
    startBar: ref.startBar,
  })).filter((s) => s.scene);

  const firstScene = sceneRefs[0]?.scene;
  if (firstScene) {
    audioEngine.activateSceneAtBoundary(firstScene);
    updateMasterSceneUi(firstScene);
  }

  canonicalPlaybackIds = scheduleArrangementPlayback(
    audioEngine,
    sceneRefs,
    session.arrangement.totalBars,
    (bar) => {
      const scene = demoController.runtime.getSceneAtBar(bar);
      if (scene) updateMasterSceneUi(scene);
      const prov = document.querySelector<HTMLElement>("#provenance-label");
      if (prov) prov.textContent = demoController.getProvenanceLabel(bar);
      refreshProductionUi();
    },
    onDone,
  );
  demoController.registerCanonicalSchedules(canonicalPlaybackIds);
  audioEngine.start();
}

function getButton(sel: string): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(sel);
  if (!el) throw new Error(`${sel} not found`);
  return el;
}

export { sceneAuthority, instrumentation, state, audioEngine, executionLog, demoController };

declare global {
  interface Window {
    __echlubExecutionLog?: typeof executionLog;
    __echlubState?: RuntimeState;
    __echlubInstrumentation?: RuntimeInstrumentation;
    __echlubExpectedScriptScheduleCount?: number;
    __echlubDemoController?: DemoController;
    __echlubDevSnapshot?: {
      materialBankVersion: number;
      materialResolutionLog: typeof audioEngine.materialResolutionLog;
      missingMaterialLog: typeof audioEngine.missingMaterialLog;
      cueCompletionLog: typeof audioEngine.cueCompletionLog;
      liveMutationLog: typeof demoController.runtime.liveMutationLog;
      topologyTransformation: string;
      masterStepCount: number;
      cueScheduleCount: number;
      cueActive: boolean;
      playingSceneId: string;
      transportState: string;
      triggerCuePreview: (draftId: string) => void;
      getComparisonPreview: () => ReturnType<typeof demoController.runtime.previewComparison>;
    };
  }
}
window.__echlubExecutionLog = executionLog;
window.__echlubState = state;
window.__echlubInstrumentation = instrumentation;
window.__echlubExpectedScriptScheduleCount = currentLiveScript().length;
window.__echlubDemoController = demoController;
window.__echlubDevSnapshot = {
  get materialBankVersion() { return demoController.runtime.materialBank.version; },
  get materialResolutionLog() { return audioEngine.materialResolutionLog; },
  get missingMaterialLog() { return audioEngine.missingMaterialLog; },
  get cueCompletionLog() { return audioEngine.cueCompletionLog; },
  get liveMutationLog() { return demoController.runtime.liveMutationLog; },
  get topologyTransformation() { return buildTopologyTransformation(demoController.runtime.session); },
  get masterStepCount() { return audioEngine.getMasterStepCount(); },
  get cueScheduleCount() { return audioEngine.getCueScheduleCount(); },
  get cueActive() { return audioEngine.isCueActive(); },
  get playingSceneId() { return audioEngine.getPlayingSceneId(); },
  get transportState() { return audioEngine.state; },
  triggerCuePreview(draftId: string) { demoController.handlePreviewDraft(draftId); },
  getComparisonPreview() {
    return demoController.runtime.previewComparison(
      sceneAuthority.executionRecords.map((record) => record.sceneId),
      state.history.length,
    );
  },
};

window.addEventListener("beforeunload", () => audioEngine.dispose());
render();
