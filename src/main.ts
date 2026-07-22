import "./style.css";
import * as Tone from "tone";
import { AudioEngine } from "./audioEngine";
import { stepsForEvent } from "./choreographyScript";
import { scenes, TOTAL_BARS } from "./musicData";
import { knobRotationForDelay, knobRotationForFilter } from "./mixMapping";
import { jamMemories, performanceScript, EXPECTED_SCRIPT_SCHEDULE_COUNT } from "./performanceScript";
import { PresentationEngine } from "./presentation";
import { executeSceneTransaction } from "./sceneTransaction";
import { executionLog } from "./executionLog";
import { clearAllTimeouts, activeTimeoutCount } from "./timerRegistry";
import { parsePosition } from "./musicalPosition";
import { applyScriptEvent, createInitialState, resetState, updateBoundaryCountdown } from "./runtimeState";
import { RuntimeInstrumentation } from "./runtimeInstrumentation";
import {
  buildLaunchBoundaryMap,
  createIdleScene,
  IDLE_SCENE_ID,
  SceneExecutionAuthority,
  sceneById,
} from "./sceneExecution";
import type { BrainId, PerformanceScriptEvent, RuntimeState, SceneDefinition } from "./types";

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

const audioEngine = new AudioEngine({
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
    const event = performanceScript.find(
      (e) => e.action === "launch" && e.target === sceneId && parsePosition(e.at).bar === bar,
    );
    if (!event) return;
    const ok = executeSceneTransaction({
      state,
      sceneAuthority,
      audioEngine,
      event,
      bar,
      transportTime: time,
    });
    if (!ok) return;
    const scene = scenes.find((s) => s.id === sceneId);
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
audioEngine.setLaunchBoundaries(buildLaunchBoundaryMap());

function render(): void {
  const idleScene = createIdleScene();
  const displayScene = sceneById(state.activeSceneId) ?? idleScene;
  app!.innerHTML = `
  <main class="app-shell ${state.recordingMode ? "recording-mode" : ""}">
    <header class="topbar glass">
      <div class="brand-block">
        <div class="brand-mark">E</div>
        <div>
          <div class="eyebrow">ROUND 2 · human choreography demo</div>
          <h1>EchLub Four-Brain DJ Lab</h1>
          <p>Four visible collaborators inside one shared musical body.</p>
        </div>
      </div>
      <div class="header-status">
        <span class="pill">92 BPM</span>
        <span class="pill">40 bars</span>
        <span class="pill">16:9 recordable</span>
        <span class="pill status-ready" id="audio-status">audio locked</span>
      </div>
    </header>

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
      <div class="transport-controls">
        <button class="button primary" id="start-button">Start auto performance</button>
        <button class="button" id="pause-button" disabled>Pause</button>
        <button class="button" id="restart-button" disabled>Restart</button>
        <button class="button" id="record-mode-button">Recording mode</button>
      </div>
      <div class="transport-readout">
        <div><span>Position</span><strong id="position">01 · 1 · 1</strong></div>
        <div><span>Next phrase</span><strong id="next-scene">Groove Established</strong></div>
        <div><span>Queued</span><strong id="queue-count">0 decisions</strong></div>
      </div>
      <div class="step-grid" id="master-grid">
        ${Array.from({ length: 16 }, (_, i) => `<i data-master-step="${i}"></i>`).join("")}
      </div>
      <div class="scene-timeline">
        ${scenes.map((s) => `<article class="scene-card ${s.id === state.activeSceneId ? "active" : ""} ${state.queue.some((q) => q.sceneId === s.id && q.status === "queued") ? "queued" : ""}" data-scene="${s.id}"><span>${String(s.startBar + 1).padStart(2, "0")}</span><strong>${s.title}</strong><small>${s.bars} bars</small></article>`).join("")}
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
    <footer class="demo-footer">Round 2 prototype — scripted collaboration film with real Tone.js runtime. Placeholder music only.</footer>
  </main>`;
  bindControls();
  presentation.initialize();
  presentation.reset();
  updateAllUi();
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
  const sceneButtons = scenes.map((s) => {
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
}

async function onStart(): Promise<void> {
  if (!initialized) {
    getButton("#start-button").disabled = true;
    getButton("#start-button").textContent = "Preparing audio…";
    await audioEngine.initialize();
    scheduleScript();
    initialized = true;
    const status = document.querySelector<HTMLElement>("#audio-status");
    if (status) { status.textContent = "audio ready"; status.classList.add("live"); }
  }
  resetRuntime();
  audioEngine.start();
  isPaused = false;
  getButton("#start-button").textContent = "Running auto performance";
  getButton("#start-button").disabled = true;
  getButton("#pause-button").disabled = false;
  getButton("#restart-button").disabled = false;
}

function onPause(): void {
  if (!initialized) return;
  if (isPaused) {
    audioEngine.resume();
    getButton("#pause-button").textContent = "Pause";
    getButton("#start-button").textContent = "Running auto performance";
  } else {
    audioEngine.pause();
    getButton("#pause-button").textContent = "Resume";
    getButton("#start-button").textContent = "Performance paused";
  }
  isPaused = !isPaused;
}

function onRestart(): void {
  if (!initialized) return;
  resetRuntime();
  audioEngine.start();
  isPaused = false;
  getButton("#pause-button").textContent = "Pause";
  getButton("#start-button").textContent = "Running auto performance";
  getButton("#start-button").disabled = true;
}

function onToggleRecording(): void {
  state.recordingMode = !state.recordingMode;
  app!.querySelector(".app-shell")?.classList.toggle("recording-mode", state.recordingMode);
  getButton("#record-mode-button").textContent = state.recordingMode ? "Exit recording mode" : "Recording mode";
}

function scheduleScript(): void {
  const transport = Tone.getTransport();
  scriptIds.forEach((id) => transport.clear(id));
  scriptIds = [];
  audioEngine.setLaunchBoundaries(buildLaunchBoundaryMap());
  for (const event of performanceScript) {
    const id = transport.schedule((time: number) => {
      if (event.action === "preview" && event.target) {
        audioEngine.startPrivateCue(event.target, parsePosition(event.at));
      }
      if (event.action === "filter" || event.action === "delay" || event.action === "fader") {
        applyPreTransitionMix(event, time);
      }
      if (event.action !== "launch") {
        applyScriptEvent(state, event);
      }
      Tone.getDraw().schedule(() => projectScriptEventUi(event), time);
    }, event.at);
    scriptIds.push(id);
  }
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

function applyPreTransitionMix(event: PerformanceScriptEvent, transportTime?: number): void {
  const atTime = transportTime ?? Tone.getTransport().seconds + 0.05;
  if (event.action === "filter" && typeof event.value === "number") {
    audioEngine.setMixParams({ filter: event.value }, 0.18, atTime);
  }
  if (event.action === "delay" && typeof event.value === "number") {
    audioEngine.setMixParams({ delayWet: event.value }, 0.18, atTime);
  }
  if (event.action === "fader" && event.target && typeof event.value === "number") {
    audioEngine.setMixParams({ faders: { [event.target]: event.value } }, 0.18, atTime);
  }
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
  const idx = scenes.findIndex((s) => s.id === scene.id);
  const next = document.querySelector<HTMLElement>("#next-scene");
  if (next) next.textContent = scenes[idx + 1]?.title ?? "Ending silence";
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
  const progress = Math.min(100, ((state.currentBar * 16 + step) / (TOTAL_BARS * 16)) * 100);
  document.documentElement.style.setProperty("--song-progress", `${progress}%`);
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
    semanticEventCount: performanceScript.length,
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

  if (initialized) {
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
  updateJamMemoryUi();
  getButton("#start-button").textContent = "Performance complete";
  getButton("#start-button").disabled = false;
  getButton("#pause-button").disabled = true;
}

function getButton(sel: string): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(sel);
  if (!el) throw new Error(`${sel} not found`);
  return el;
}

export { sceneAuthority, instrumentation, state, audioEngine, executionLog };

declare global {
  interface Window {
    __echlubExecutionLog?: typeof executionLog;
    __echlubState?: RuntimeState;
    __echlubInstrumentation?: RuntimeInstrumentation;
    __echlubExpectedScriptScheduleCount?: number;
  }
}
window.__echlubExecutionLog = executionLog;
window.__echlubState = state;
window.__echlubInstrumentation = instrumentation;
window.__echlubExpectedScriptScheduleCount = EXPECTED_SCRIPT_SCHEDULE_COUNT;

window.addEventListener("beforeunload", () => audioEngine.dispose());
render();
