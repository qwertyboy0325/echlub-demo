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
import { participantsForCapability } from "./domain/performanceModel";
import type { CapabilityOperationEvidence } from "./demo/capabilityLiveOperations";
import { DemoController, scheduleArrangementPlayback } from "./demo/demoController";
import { schedulePackMixAutomation } from "./demo/mixAutomationSchedule";
import { capabilityTargetForElement } from "./capabilityUiTargets";
import { capabilityIdsNeedingRefresh, renderCapabilityWorkspace } from "./ui/liveCapabilityWorkspaces";
import { buildTopologyTransformation } from "./demo/canonicalPlayback";
import { enterAct, registerLiveSchedules } from "./demo/actScheduleRegistry";
import type { DemoAct } from "./domain/sessionTypes";
import { arrangementLaunchBoundaries } from "./demo/liveStructuralPlan";
import { importReconstructionPackFile, parseReconstructionPackJson } from "./domain/packLoader";
import { renderAppShell, renderTrackList, renderTransportStrip } from "./ui/appShell";
import { renderParticipantRail } from "./ui/participantRail";
import { renderSessionView } from "./ui/sessionView";
import { renderArrangementView } from "./ui/arrangementView";
import { renderClipDetailView } from "./ui/clipDetailView";
import { renderCollaborationInspector } from "./ui/collaborationInspector";
import { legacyBrainPanelsFromState, renderPerformanceOverlay } from "./ui/performanceOverlay";
import { renderComparisonView } from "./ui/comparisonView";
import { pianoNoteInlineStyle, pianoRollDataAttributes } from "./ui/pianoRollProjection";
import { OfflineExportController, formatExportProgress, type CanonicalExportContext } from "./offline/exportController";

const brainMeta: Record<BrainId, { title: string; subtitle: string; symbol: string }> = {
  memory: { title: "Material Deck", subtitle: "cue, audition and replace musical phrases", symbol: "M" },
  pulse: { title: "Rhythm Deck", subtitle: "reshape groove, timing and musical gaps", symbol: "P" },
  blend: { title: "Mixer / FX", subtitle: "control balance, filter, echo and space", symbol: "B" },
  story: { title: "Scene Launcher", subtitle: "queue, hold and redirect song structure", symbol: "S" },
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
let experienceStarted = false;
let comparisonHtml = "";
const exportController = new OfflineExportController(updateExportUi);

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
      refreshDawUi();
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
  refreshProductionUi: refreshDawUi,
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
    refreshDawUi();
  },
  runLivePerformance: () => { void runLivePerformanceAct(); },
  showComparison: (comparison) => {
    const topology = buildTopologyTransformation(demoController.runtime.session);
    const canonical = demoController.runtime.canonicalSnapshot ?? demoController.runtime.session;
    comparisonHtml = renderComparisonView(comparison, canonical, demoController.runtime.session, topology);
    demoMode = "comparison";
    app!.querySelector(".app-shell")?.setAttribute("data-act", "comparison");
    refreshDawUi();
  },
  scheduleCanonicalPlayback: (onDone) => { void runCanonicalPlaybackAct(onDone); },
});
audioEngine.setBaseBpm(demoController.runtime.pack.metadata.bpm);
audioEngine.setTempoMap(demoController.runtime.pack.tempoMap);
audioEngine.setTotalBars(demoController.runtime.session.arrangement.totalBars);

function currentLiveScript(): readonly PerformanceScriptEvent[] {
  return demoController.runtime.pack.livePerformanceChoreography;
}

function render(): void {
  const idleScene = createIdleScene();
  const displayScene = sceneById(state.activeSceneId) ?? idleScene;
  const isPublicSongDemo = demoController.runtime.pack.metadata.source === "public-demo";
  const session = demoController.runtime.session;
  const sceneCards = session.scenes.map((s) =>
    `<article class="scene-card ${s.id === state.activeSceneId ? "active" : ""} ${state.queue.some((q) => q.sceneId === s.id && q.status === "queued") ? "queued" : ""}" data-scene="${s.id}"><span>${String(s.startBar + 1).padStart(2, "0")}</span><strong>${s.title}</strong><small>${s.bars} bars</small></article>`,
  ).join("");
  const masterGrid = Array.from({ length: 16 }, (_, i) => `<i data-master-step="${i}"></i>`).join("");
  const boundaryHtml = `
    <div class="boundary-countdown" id="boundary-countdown" data-phase="idle">
      <span class="boundary-label" id="boundary-label">—</span>
      <span class="boundary-ticks" id="boundary-ticks"></span>
    </div>`;

  const launcherHtml = `
    <section class="demo-controls experience-launcher glass">
      <div class="experience-copy">
        <span class="eyebrow">CHOOSE YOUR EXPERIENCE</span>
        <h2>先聽歌，或觀看它如何被製作與重組</h2>
        <p>第一次點擊會解鎖瀏覽器音訊。直接播放全曲會跳過製作動畫，從 ${session.arrangement.totalBars}-bar canonical arrangement 開始。</p>
      </div>
      <div class="experience-actions">
        <button class="button primary listen-now" id="skip-playback"><strong>▶ 立即播放全曲</strong><span>完整 canonical song · 約 5 分鐘</span></button>
        <button class="button journey" id="start-button"><strong>觀看完整旅程</strong><span>製作 → 全曲 → Live Remix</span></button>
        <button class="button journey" id="skip-performance"><strong>進入 Live Remix</strong><span>直接把歌曲當成 DJ 樂器</span></button>
      </div>
      <div class="transport-controls utility-controls">
        <button class="button" id="pause-button" disabled>Pause</button>
        <button class="button" id="restart-button" disabled>Restart</button>
        <button class="button" id="record-mode-button">Recording mode</button>
        <button class="button mini" id="skip-production">回到製作階段</button>
        <label class="speed-control">Speed <input type="range" id="speed-control" min="1" max="8" value="1" /></label>
        <label class="pack-import">Local pack <input type="file" id="pack-file-input" accept="application/json,.json" /></label>
        <button class="button" id="export-quick-review-button">Export Quick Review</button>
        <button class="button" id="export-wav-button">Export Master WAV</button>
        <button class="button" id="export-evidence-button">Export Master Evidence Bundle</button>
        <button class="button mini" id="export-cancel-button" hidden>Cancel export</button>
        <span class="pack-import-status" id="pack-import-status">${isPublicSongDemo ? "bundled · public song demo" : "validated placeholder"}</span>
        <span class="pack-import-status" id="export-status">Ready</span>
      </div>
    </section>`;

  const dawCtx = buildDawShellContext({
    isPublicSongDemo,
    displayScene,
    sceneCards,
    masterGrid,
    boundaryHtml,
    launcherHtml,
  });

  app!.innerHTML = renderAppShell(dawCtx);
  bindControls();
  presentation.initialize();
  presentation.reset();
  seedJamMemoryButtons();
  refreshDawUi();
  updateAllUi();
  updateExportUi();
}

interface DawShellParts {
  isPublicSongDemo: boolean;
  displayScene: SceneDefinition;
  sceneCards: string;
  masterGrid: string;
  boundaryHtml: string;
  launcherHtml: string;
}

function liveWorkspaceCtx() {
  return { session: demoController.runtime.session, state, previewBrain: state.previewBrain };
}

function buildDawShellContext(parts: DawShellParts) {
  const session = demoController.runtime.session;
  const isPublicSongDemo = parts.isPublicSongDemo;
  const mainWorkspace = demoMode === "comparison" && comparisonHtml
    ? comparisonHtml
    : demoMode === "canonicalPlayback"
      ? renderArrangementView(session, state.currentBar)
      : renderSessionView({ session, director: demoController.director, state, selectedDraftId: state.activeDraftId });

  const performanceOverlay = demoMode === "livePerformance"
    ? renderPerformanceOverlay({
        session,
        state,
        panels: legacyBrainPanelsFromState(session, renderWorkspace, liveWorkspaceCtx()),
        viewLabel: demoController.director.getFocusState().actLabel,
      })
    : undefined;

  return {
    act: demoMode,
    experienceStarted,
    recordingMode: state.recordingMode,
    isPublicSongDemo,
    metadata: {
      title: demoController.runtime.pack.metadata.title,
      bpm: demoController.runtime.pack.metadata.bpm,
      totalBars: session.arrangement.totalBars,
      packLabel: demoController.runtime.pack.metadata.title,
    },
    launcherHtml: parts.launcherHtml,
    transportHtml: renderTransportStrip({
      sceneTitle: parts.displayScene.title,
      sceneDescription: parts.displayScene.description,
      position: "01 · 1 · 1",
      nextScene: session.scenes[1]?.title ?? "Ending",
      queueCount: "0 decisions",
      provenance: "—",
      sceneCardsHtml: parts.sceneCards,
      masterGridHtml: parts.masterGrid,
      boundaryHtml: parts.boundaryHtml,
    }),
    participantRailHtml: renderParticipantRail(session, demoController.director),
    trackListHtml: renderTrackList(session.tracks),
    mainWorkspaceHtml: mainWorkspace,
    inspectorHtml: renderCollaborationInspector({ session, state, selectedDraftId: state.activeDraftId }),
    clipDetailHtml: renderClipDetailView({ session, draftId: state.activeDraftId, previewBrain: state.previewBrain }),
    footerHtml: isPublicSongDemo
      ? "Public cover concept demo · synthesized from derived note and arrangement data · no source recording, stem, score, or lyrics are bundled."
      : "Collaborative DAW prototype — production, canonical playback, and live recomposition share one material lineage.",
    performanceOverlayHtml: performanceOverlay,
    comparisonHtml: comparisonHtml || undefined,
  };
}

function refreshDawUi(): void {
  const session = demoController.runtime.session;
  const main = document.querySelector(".daw-main");
  if (main) {
    main.classList.toggle("daw-main-arrangement", demoMode === "canonicalPlayback");
    main.classList.toggle("daw-main-session", demoMode !== "canonicalPlayback" && demoMode !== "comparison");
    main.classList.toggle("daw-main-comparison", demoMode === "comparison");
    main.innerHTML = demoMode === "comparison" && comparisonHtml
      ? comparisonHtml
      : demoMode === "canonicalPlayback"
        ? renderArrangementView(session, state.currentBar)
        : renderSessionView({ session, director: demoController.director, state, selectedDraftId: state.activeDraftId });
  }
  const rail = document.querySelector("#participant-rail");
  if (rail) rail.outerHTML = renderParticipantRail(session, demoController.director);
  const inspector = document.querySelector("#collaboration-inspector");
  if (inspector) {
    inspector.outerHTML = renderCollaborationInspector({ session, state, selectedDraftId: state.activeDraftId });
  }
  const clipDetailWrap = document.querySelector(".daw-clip-detail");
  if (clipDetailWrap) {
    clipDetailWrap.classList.toggle("daw-clip-detail-secondary", demoMode === "livePerformance" || demoMode === "comparison");
  }
  const clipDetail = document.querySelector("#clip-detail-view");
  if (clipDetail && demoMode !== "comparison") {
    clipDetail.outerHTML = renderClipDetailView({ session, draftId: state.activeDraftId, previewBrain: state.previewBrain });
  } else if (clipDetailWrap && demoMode === "comparison") {
    clipDetailWrap.innerHTML = "";
  }
  const liveDock = document.querySelector("#daw-live-dock");
  if (demoMode === "livePerformance") {
    const overlayHtml = renderPerformanceOverlay({
      session,
      state,
      panels: legacyBrainPanelsFromState(session, renderWorkspace, liveWorkspaceCtx()),
      viewLabel: demoController.director.getFocusState().actLabel,
    });
    if (liveDock) {
      liveDock.innerHTML = overlayHtml;
    } else {
      document.querySelector("#daw-workspace")?.insertAdjacentHTML(
        "beforeend",
        `<div class="daw-live-dock" id="daw-live-dock">${overlayHtml}</div>`,
      );
    }
    presentation.initialize();
  } else if (liveDock) {
    liveDock.remove();
  }
  demoController.director.applyDomFocus(app!);
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
    `<div class="piano-note status-${draft?.status ?? "editing"}" data-note-id="${n.id}" style="${pianoNoteInlineStyle(n, draft)}"><span>${n.note}</span></div>`,
  ).join("");
  return `
    <div class="workspace-toolbar">${tabs}</div>
    <div class="piano-roll brain-primary-target ${state.previewBrain === "memory" ? "private-preview" : ""}" data-target="memory-grid" ${pianoRollDataAttributes(draft)}>
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

function updateExportUi(): void {
  const status = document.querySelector<HTMLElement>("#export-status");
  const wavButton = document.querySelector<HTMLButtonElement>("#export-wav-button");
  const quickReviewButton = document.querySelector<HTMLButtonElement>("#export-quick-review-button");
  const evidenceButton = document.querySelector<HTMLButtonElement>("#export-evidence-button");
  const cancelButton = document.querySelector<HTMLButtonElement>("#export-cancel-button");
  const state = exportController.getState();
  if (status) status.textContent = formatExportProgress(state);
  const busy = exportController.isBusy();
  if (wavButton) wavButton.disabled = busy;
  if (quickReviewButton) quickReviewButton.disabled = busy;
  if (evidenceButton) evidenceButton.disabled = busy;
  if (cancelButton) cancelButton.hidden = !busy;
}

function seedJamMemoryButtons(): void {
  const list = document.querySelector("#memory-list");
  const count = document.querySelector("#memory-count");
  if (!list) return;
  list.innerHTML = jamMemories.map((m) =>
    `<button data-memory="${m.id}" disabled><span>${m.at.split(":")[0]}</span><strong>${m.title}</strong><small>${m.description}</small></button>`,
  ).join("");
  if (count) count.textContent = `0 / ${jamMemories.length}`;
}

function buildCanonicalExportContext(): CanonicalExportContext {
  const runtime = demoController.runtime;
  if (!runtime.session.productionComplete) {
    runtime.completeProductionInstantly();
  }
  return {
    pack: runtime.pack,
    session: runtime.canonicalSnapshot ?? runtime.session,
    materialBank: runtime.canonicalBank ?? runtime.materialBank,
  };
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
  document.querySelector("#export-quick-review-button")?.addEventListener("click", () => {
    void exportController.exportQuickReviewBundle(buildCanonicalExportContext());
  });
  document.querySelector("#export-wav-button")?.addEventListener("click", () => {
    void exportController.exportWav(buildCanonicalExportContext());
  });
  document.querySelector("#export-evidence-button")?.addEventListener("click", () => {
    void exportController.exportEvidenceBundle(buildCanonicalExportContext());
  });
  document.querySelector("#export-cancel-button")?.addEventListener("click", () => {
    exportController.cancel();
  });
  app?.addEventListener("click", (event) => {
    const el = (event.target as Element | null)?.closest("[data-capability-cue],[data-capability-offer]");
    if (!el || demoMode !== "livePerformance") return;
    const capTarget = capabilityTargetForElement(el);
    if (!capTarget) return;
    event.preventDefault();
    demoController.executeCapabilityOperation(capTarget.capabilityId, capTarget.operation);
    presentation.markCapabilityFocus(capTarget.capabilityId);
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
    applyLoadedPack(pack);
    render();
    const nextStatus = document.querySelector<HTMLElement>("#pack-import-status");
    if (nextStatus) nextStatus.textContent = `local only · ${pack.metadata.source}`;
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : String(error);
    input.value = "";
  }
}

function applyLoadedPack(pack: import("./domain/reconstructionPack").ReconstructionPack): void {
  demoController.loadPack(pack);
  audioEngine.setBaseBpm(pack.metadata.bpm);
  audioEngine.setTempoMap(pack.tempoMap);
  audioEngine.setTotalBars(pack.arrangement.totalBars);
  window.__echlubExpectedScriptScheduleCount = pack.livePerformanceChoreography.length;
}

async function loadBundledSongDemo(): Promise<void> {
  try {
    const response = await fetch(new URL("shiki-no-uta.demo.pack.json", document.baseURI), { cache: "no-store" });
    if (!response.ok) return;
    applyLoadedPack(parseReconstructionPackJson(await response.text()));
  } catch {
    // Keep the validated placeholder as a safe offline fallback.
  }
}

async function onSkipAct(act: DemoAct): Promise<void> {
  experienceStarted = true;
  app!.querySelector(".app-shell")?.setAttribute("data-experience-started", "true");
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
    getButton("#start-button").textContent = "正在播放全曲…";
  } else if (act === "livePerformance") {
    resetRuntime();
    demoController.syncSessionToState();
    await runLivePerformanceAct();
    getButton("#start-button").textContent = "Live Remix 進行中…";
  } else {
    resetRuntime();
    demoController.syncSessionToState();
    refreshDawUi();
    refreshWorkspaces();
    updateAllUi();
    getButton("#start-button").textContent = "觀看完整旅程";
    getButton("#start-button").disabled = false;
  }
  getButton("#pause-button").disabled = false;
  getButton("#restart-button").disabled = false;
}

async function onStart(): Promise<void> {
  experienceStarted = true;
  app!.querySelector(".app-shell")?.setAttribute("data-experience-started", "true");
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
      if (event.action === "capability" && event.capabilityId && event.capabilityOperation) {
        const evidence = demoController.executeCapabilityOperation(event.capabilityId, event.capabilityOperation);
        presentation.markCapabilityFocus(event.capabilityId);
        Tone.getDraw().schedule(() => projectCapabilityEventUi(event, evidence), time);
        return;
      }
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
  const automationIds = schedulePackMixAutomation(
    audioEngine,
    demoController.runtime.pack.mixAutomation,
    "livePerformance",
  );
  scriptIds.push(...automationIds);
  registerLiveSchedules(demoController.runtime.scheduleRegistry, scriptIds);
  instrumentation.setScheduleCount(scriptIds.length);
}

function projectCapabilityEventUi(
  event: PerformanceScriptEvent,
  evidence: CapabilityOperationEvidence | null,
): void {
  instrumentation.logEvent(event);
  if (!event.capabilityId) return;

  const session = demoController.runtime.session;
  const operators = participantsForCapability(session.performanceConfig, event.capabilityId, session.participants)
    .map((p) => p.displayName)
    .join(" · ");
  const cap = session.performanceConfig.capabilities.find((c) => c.id === event.capabilityId);
  const label = document.querySelector<HTMLElement>("#action-label");
  const detail = document.querySelector<HTMLElement>("#action-detail");
  const actor = document.querySelector<HTMLElement>("#action-actor");
  if (label) label.textContent = event.label;
  if (detail) {
    const repin = evidence?.repinnedSceneRefs?.[0];
    detail.textContent = repin
      ? `${event.detail} · repinned ${repin.sceneId}/${repin.layer} rev ${repin.revision}`
      : event.detail;
  }
  if (actor) actor.textContent = `${cap?.label ?? event.capabilityId} · ${operators}`;

  const thoughtEl = document.querySelector<HTMLElement>(`#${event.capabilityId}-thought`);
  const stateEl = document.querySelector<HTMLElement>(`#${event.capabilityId}-state`);
  if (thoughtEl) thoughtEl.textContent = event.detail;
  if (stateEl) stateEl.textContent = evidence?.draftStatus ?? event.capabilityOperation ?? "active";

  if (event.capabilityOperation === "privateCue" && evidence) {
    document.querySelector(`[data-capability="${event.capabilityId}"]`)?.classList.add("brain-preview");
  }
  if (event.capabilityOperation === "revision" && evidence) {
    document.querySelectorAll(".scene-card").forEach((el) => {
      const sceneId = el.getAttribute("data-scene");
      if (sceneId && evidence.repinnedSceneRefs.some((ref) => ref.sceneId === sceneId)) {
        el.classList.add("queued");
      }
    });
  }

  const steps = stepsForEvent(event.id);
  if (steps.length) presentation.executeSteps(steps);
  refreshWorkspaces();
  updateAllUi();
  instrumentation.setGsapTweenCount(presentation.getActiveTimelineCount());
}

function projectScriptEventUi(event: PerformanceScriptEvent): void {
  instrumentation.logEvent(event);
  updateActionUi(event);

  if (event.action === "preview" && event.brain) {
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
  if (!event.brain) return;
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
  const session = demoController.runtime.session;
  const ctx = liveWorkspaceCtx();
  for (const capId of capabilityIdsNeedingRefresh(session)) {
    const cap = session.performanceConfig.capabilities.find((c) => c.id === capId);
    const html = renderCapabilityWorkspace(capId, ctx, renderWorkspace, cap?.legacyBrainId);
    if (cap?.legacyBrainId) {
      const ws = document.querySelector(`[data-brain="${cap.legacyBrainId}"] .brain-workspace`);
      if (ws) ws.innerHTML = html;
    } else {
      const ws = document.querySelector(`[data-capability="${capId}"] .capability-workspace`);
      if (ws) ws.innerHTML = html;
    }
  }
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
  const capCount = demoController.runtime.session.performanceConfig.views
    .find((v) => v.id === demoController.runtime.session.performanceConfig.activeViewId)
    ?.capabilityIds.length ?? 0;
  if (detail) detail.textContent = `Live operators prepare ${capCount} performance capabilities over the shared session materials.`;
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
  refreshDawUi();
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
  audioEngine.clearArrangementSceneBoundaries();
  audioEngine.clearPackMixAutomation();
  audioEngine.clearMixAutomationLog();

  const sceneRefs = session.arrangement.scenes.map((ref) => ({
    scene: session.scenes.find((s) => s.id === ref.sceneId)!,
    startBar: ref.startBar,
  })).filter((s) => s.scene);

  audioEngine.setArrangementSceneBoundaries(sceneRefs);
  const firstScene = sceneRefs[0]?.scene;
  if (firstScene) {
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
      refreshDawUi();
    },
    () => {
      // Canonical playback has one completion authority: the arrangement's
      // explicit total-bar boundary. Stop it before resolving the controller
      // promise so a delayed Draw callback cannot stop the next Live act.
      audioEngine.stop();
      onDone();
    },
  );
  const automationIds = schedulePackMixAutomation(
    audioEngine,
    demoController.runtime.pack.mixAutomation,
    "canonicalPlayback",
  );
  canonicalPlaybackIds.push(...automationIds);
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
      soundDesign: ReturnType<typeof audioEngine.getSoundDesignPreset>;
      tempoMap: ReturnType<typeof audioEngine.getTempoMap>;
      currentBaseBpm: number;
      masterLevelDb: number;
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
  get soundDesign() { return audioEngine.getSoundDesignPreset(); },
  get tempoMap() { return audioEngine.getTempoMap(); },
  get currentBaseBpm() { return audioEngine.getCurrentBaseBpm(); },
  get masterLevelDb() { return audioEngine.getMasterLevelDb(); },
  triggerCuePreview(draftId: string) { demoController.handlePreviewDraft(draftId); },
  getComparisonPreview() {
    return demoController.runtime.previewComparison(
      sceneAuthority.executionRecords.map((record) => record.sceneId),
      state.history.length,
    );
  },
};

window.addEventListener("beforeunload", () => audioEngine.dispose());
await loadBundledSongDemo();
render();
