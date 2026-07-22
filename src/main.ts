import "./style.css";
import * as Tone from "tone";
import { AudioEngine } from "./audioEngine";
import { initialDrafts, scenes, sceneForBar, TOTAL_BARS } from "./musicData";
import { jamMemories, performanceScript } from "./performanceScript";
import { PresentationEngine } from "./presentation";
import type { BrainId, DraftStatus, PerformanceScriptEvent, RuntimeState, SceneDefinition } from "./types";

const brainMeta: Record<BrainId, { title: string; subtitle: string; symbol: string }> = {
  memory: { title: "Memory / Cue", subtitle: "phrases, fragments and private audition", symbol: "M" },
  pulse: { title: "Pulse / Timing", subtitle: "groove, quantization and musical gaps", symbol: "P" },
  blend: { title: "Blend / Space", subtitle: "filter, echo, width and attention", symbol: "B" },
  story: { title: "Story / Structure", subtitle: "scenes, extension, release and return", symbol: "S" },
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

const draftsById = Object.fromEntries(initialDrafts.map((draft) => [draft.id, structuredClone(draft)]));
const state: RuntimeState = {
  activeSceneId: "opening",
  currentBar: 0,
  currentBeat: 0,
  currentSixteenth: 0,
  focusedBrain: null,
  thoughts: {
    memory: "Waiting to hear which fragment the piece needs.",
    pulse: "Watching the shared grid for a useful entry point.",
    blend: "Holding the mix in a narrow, distant space.",
    story: "The full phrase should arrive later, not now.",
  },
  drafts: draftsById,
  queue: [],
  history: [],
  lastAction: null,
};

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar glass">
      <div class="brand-block">
        <div class="brand-mark">E</div>
        <div>
          <div class="eyebrow">ROUND 1 · audible structural skeleton</div>
          <h1>EchLub Four-Brain DJ Lab</h1>
          <p>One musical body, four visible decision systems.</p>
        </div>
      </div>
      <div class="header-status">
        <span class="pill">92 BPM</span>
        <span class="pill">40 bars</span>
        <span class="pill">scripted performance</span>
        <span class="pill status-ready" id="audio-status">audio locked</span>
      </div>
    </header>

    <section class="master-stage glass">
      <div class="master-copy">
        <div class="eyebrow">MASTER OUTPUT</div>
        <h2 id="scene-title">Opening Memory</h2>
        <p id="scene-description">A blurred fragment appears before the groove has fully formed.</p>
      </div>
      <div class="transport-controls">
        <button class="button primary" id="start-button">Start auto performance</button>
        <button class="button" id="pause-button" disabled>Pause</button>
        <button class="button" id="restart-button" disabled>Restart</button>
      </div>
      <div class="transport-readout">
        <div><span>Position</span><strong id="position">00 · 1 · 1</strong></div>
        <div><span>Next phrase</span><strong id="next-scene">Groove Established</strong></div>
        <div><span>Queued</span><strong id="queue-count">0 decisions</strong></div>
      </div>
      <div class="step-grid" id="master-grid">
        ${Array.from({ length: 16 }, (_, index) => `<i data-master-step="${index}"></i>`).join("")}
      </div>
      <div class="scene-timeline">
        ${scenes.map((scene) => `
          <article class="scene-card ${scene.id === "opening" ? "active" : ""}" data-scene="${scene.id}">
            <span>${String(scene.startBar + 1).padStart(2, "0")}</span>
            <strong>${scene.title}</strong>
            <small>${scene.bars} bars</small>
          </article>
        `).join("")}
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
          <span>Editing</span><b>→</b><span>Private preview</span><b>→</b><span>Offered</span><b>→</b><span>Queued</span><b>→</b><span>Playing</span>
        </div>
      </article>
      <article class="glass jam-memory">
        <div class="section-heading"><div><span class="eyebrow">JAM MEMORY</span><h3>Captured structural moments</h3></div><span id="memory-count">0 / ${jamMemories.length}</span></div>
        <div class="memory-list" id="memory-list">
          ${jamMemories.map((memory) => `<button data-memory="${memory.id}" disabled><span>${memory.at.split(":")[0]}</span><strong>${memory.title}</strong><small>${memory.description}</small></button>`).join("")}
        </div>
      </article>
    </section>

    <footer>
      Round 1 uses original placeholder MIDI and synthesis. It validates the DAW interaction grammar before the reference reconstruction is imported.
    </footer>
  </main>
`;

function renderBrainWindow(brain: BrainId): string {
  const meta = brainMeta[brain];
  return `
    <article class="brain-window glass" data-brain="${brain}">
      <div class="brain-header">
        <div class="brain-id">${meta.symbol}</div>
        <div><span class="eyebrow">BRAIN ${meta.symbol}</span><h3>${meta.title}</h3><p>${meta.subtitle}</p></div>
        <span class="brain-state" id="${brain}-state">idle</span>
      </div>
      <div class="brain-workspace">
        ${renderBrainWorkspace(brain)}
      </div>
      <div class="thought-strip"><span>thinking</span><p id="${brain}-thought">${state.thoughts[brain]}</p></div>
      <div class="virtual-cursor" data-cursor="${brain}"><i></i><b>${meta.symbol}</b></div>
    </article>
  `;
}

function renderBrainWorkspace(brain: BrainId): string {
  if (brain === "memory") {
    const notes = [1, 3, 4, 6, 9, 11, 13, 14];
    return `
      <div class="workspace-toolbar"><button class="mini active" data-target="memory-opening">Opening</button><button class="mini" data-target="memory-main">Main</button><button class="mini" data-target="memory-response">Response</button></div>
      <div class="piano-roll brain-primary-target" data-target="memory-grid">
        ${Array.from({ length: 32 }, (_, index) => `<i class="${notes.includes(index % 16) ? "note" : ""}" style="--row:${index % 4};--col:${Math.floor(index / 2)}"></i>`).join("")}
      </div>
      <div class="workspace-actions"><button data-target="private-cue">Private cue</button><button data-target="offer-memory">Offer phrase</button></div>
    `;
  }
  if (brain === "pulse") {
    return `
      <div class="workspace-toolbar"><button class="mini active" data-target="pulse-sparse">Sparse</button><button class="mini" data-target="pulse-full">Full</button><button class="mini" data-target="pulse-break">Break</button></div>
      <div class="sequencer brain-primary-target" data-target="pulse-grid">
        ${["Kick", "Snare", "Hat"].map((name, row) => `<div><span>${name}</span>${Array.from({ length: 16 }, (_, step) => { const isOn = (row === 0 && [0, 6, 8, 14].includes(step)) || (row === 1 && [4, 12].includes(step)) || (row === 2 && step % 2 === 0); return `<i class="${isOn ? "on" : ""}" data-seq-step="${row}-${step}"></i>`; }).join("")}</div>`).join("")}
      </div>
      <div class="workspace-actions"><button data-target="quantize">Quantize 1/16</button><button data-target="offer-pulse">Offer timing</button></div>
    `;
  }
  if (brain === "blend") {
    return `
      <div class="mixer brain-primary-target">
        ${["Groove", "Harmony", "Melody", "Texture"].map((name, index) => `<div class="channel"><strong>${name}</strong><div class="fader"><i style="height:${[64, 48, 28, 58][index]}%"></i><b style="bottom:${[64, 48, 28, 58][index]}%"></b></div><span>${["-5", "-9", "-14", "-7"][index]} dB</span></div>`).join("")}
      </div>
      <div class="fx-row"><label data-target="blend-filtered"><span>Filter</span><i><b id="filter-knob"></b></i></label><label data-target="delay-send"><span>Echo</span><i><b id="delay-knob"></b></i></label><label data-target="blend-release"><span>Width</span><i><b></b></i></label></div>
    `;
  }
  return `
    <div class="arrangement brain-primary-target">
      ${scenes.map((scene) => `<button data-target="${scene.id}" data-story-scene="${scene.id}"><span>${String(scene.startBar + 1).padStart(2, "0")}</span><strong>${scene.title}</strong><small>${scene.bars} bars</small></button>`).join("")}
    </div>
    <div class="workspace-actions"><button data-target="hold-scene">Hold 4 bars</button><button data-target="commit-scene">Commit scene</button></div>
  `;
}

const presentation = new PresentationEngine();
presentation.initialize();
presentation.reset();

let scriptIds: number[] = [];
let initialized = false;
let isPaused = false;

const audioEngine = new AudioEngine({
  onStep: (bar, beat, sixteenth) => {
    state.currentBar = bar;
    state.currentBeat = beat;
    state.currentSixteenth = sixteenth;
    updateTransportUi();
  },
  onScene: (scene) => activateScene(scene),
  onFinished: () => finishPerformance(),
});

const startButton = getButton("#start-button");
const pauseButton = getButton("#pause-button");
const restartButton = getButton("#restart-button");

startButton.addEventListener("click", async () => {
  if (!initialized) {
    startButton.disabled = true;
    startButton.textContent = "Preparing audio…";
    await audioEngine.initialize();
    scheduleScript();
    initialized = true;
    document.querySelector<HTMLElement>("#audio-status")!.textContent = "audio ready";
    document.querySelector<HTMLElement>("#audio-status")!.classList.add("live");
  }
  resetRuntime();
  audioEngine.start();
  isPaused = false;
  startButton.textContent = "Running auto performance";
  startButton.disabled = true;
  pauseButton.disabled = false;
  restartButton.disabled = false;
});

pauseButton.addEventListener("click", () => {
  if (!initialized) return;
  if (isPaused) {
    audioEngine.resume();
    pauseButton.textContent = "Pause";
    startButton.textContent = "Running auto performance";
  } else {
    audioEngine.pause();
    pauseButton.textContent = "Resume";
    startButton.textContent = "Performance paused";
  }
  isPaused = !isPaused;
});

restartButton.addEventListener("click", () => {
  if (!initialized) return;
  resetRuntime();
  audioEngine.start();
  isPaused = false;
  pauseButton.textContent = "Pause";
  pauseButton.disabled = false;
  startButton.textContent = "Running auto performance";
  startButton.disabled = true;
});

function scheduleScript(): void {
  const transport = Tone.getTransport();
  scriptIds.forEach((id) => transport.clear(id));
  scriptIds = performanceScript.map((event) => transport.schedule((time: number) => {
    Tone.getDraw().schedule(() => applyScriptEvent(event), time);
  }, event.at));
}

function applyScriptEvent(event: PerformanceScriptEvent): void {
  state.lastAction = event;
  state.focusedBrain = event.brain;
  state.thoughts[event.brain] = event.detail;
  updateDraftState(event);
  updateActionUi(event);
  presentation.playEvent(event);

  if (event.action === "queue" && event.target) {
    if (!state.queue.includes(event.target)) state.queue.push(event.target);
  }
  if (event.action === "launch" && event.target) {
    state.queue = state.queue.filter((item) => item !== event.target);
    const scene = scenes.find((candidate) => candidate.id === event.target);
    if (scene) activateScene(scene);
    presentation.flashMaster();
  }
  if (event.action === "filter" && typeof event.value === "number") {
    const knob = document.querySelector<HTMLElement>("#filter-knob");
    if (knob) knob.style.transform = `rotate(${Math.min(135, -120 + event.value / 15)}deg)`;
  }
  if (event.action === "delay" && typeof event.value === "number") {
    const knob = document.querySelector<HTMLElement>("#delay-knob");
    if (knob) knob.style.transform = `rotate(${-120 + event.value * 260}deg)`;
  }
  if (event.action === "memory") captureAvailableMemories();
  renderState();
}

function updateDraftState(event: PerformanceScriptEvent): void {
  if (!event.target || !state.drafts[event.target]) return;
  const statusByAction: Partial<Record<PerformanceScriptEvent["action"], DraftStatus>> = {
    edit: "editing",
    preview: "preview",
    ready: "ready",
    offer: "offered",
    queue: "queued",
    launch: "playing",
  };
  const nextStatus = statusByAction[event.action];
  if (nextStatus) state.drafts[event.target].status = nextStatus;
}

function activateScene(scene: SceneDefinition): void {
  state.activeSceneId = scene.id;
  document.querySelectorAll(".scene-card").forEach((element) => element.classList.toggle("active", element.getAttribute("data-scene") === scene.id));
  document.querySelectorAll("[data-story-scene]").forEach((element) => element.classList.toggle("playing", element.getAttribute("data-story-scene") === scene.id));
  document.querySelector<HTMLElement>("#scene-title")!.textContent = scene.title;
  document.querySelector<HTMLElement>("#scene-description")!.textContent = scene.description;
  const index = scenes.findIndex((candidate) => candidate.id === scene.id);
  document.querySelector<HTMLElement>("#next-scene")!.textContent = scenes[index + 1]?.title ?? "Ending silence";
  presentation.pulseScene(scene.id);
  captureAvailableMemories();
}

function captureAvailableMemories(): void {
  const transportBar = state.currentBar;
  jamMemories.forEach((memory) => {
    const requiredBar = Number(memory.at.split(":")[0]);
    if (transportBar >= requiredBar && !state.history.some((item) => item.id === memory.id)) {
      state.history.push(memory);
      const button = document.querySelector<HTMLButtonElement>(`[data-memory="${memory.id}"]`);
      if (button) {
        button.disabled = false;
        button.classList.add("captured");
      }
    }
  });
  document.querySelector<HTMLElement>("#memory-count")!.textContent = `${state.history.length} / ${jamMemories.length}`;
}

function updateTransportUi(): void {
  const step = state.currentBeat * 4 + state.currentSixteenth;
  document.querySelectorAll("[data-master-step]").forEach((element, index) => element.classList.toggle("active", index === step));
  document.querySelector<HTMLElement>("#position")!.textContent = `${String(state.currentBar + 1).padStart(2, "0")} · ${state.currentBeat + 1} · ${state.currentSixteenth + 1}`;
  const progress = Math.min(100, ((state.currentBar * 16 + step) / (TOTAL_BARS * 16)) * 100);
  document.documentElement.style.setProperty("--song-progress", `${progress}%`);
  captureAvailableMemories();
}

function updateActionUi(event: PerformanceScriptEvent): void {
  document.querySelector<HTMLElement>("#action-label")!.textContent = event.label;
  document.querySelector<HTMLElement>("#action-detail")!.textContent = event.detail;
  document.querySelector<HTMLElement>("#action-actor")!.textContent = brainMeta[event.brain].title;
  document.querySelector<HTMLElement>(`#${event.brain}-thought`)!.textContent = event.detail;
  document.querySelectorAll(".brain-state").forEach((element) => { element.textContent = "observing"; });
  document.querySelector<HTMLElement>(`#${event.brain}-state`)!.textContent = event.action;
}

function renderState(): void {
  document.querySelector<HTMLElement>("#queue-count")!.textContent = `${state.queue.length} decision${state.queue.length === 1 ? "" : "s"}`;
  Object.values(state.drafts).forEach((draft) => {
    const target = document.querySelector<HTMLElement>(`[data-target="${draft.id}"]`);
    if (!target) return;
    target.dataset.status = draft.status;
    target.classList.toggle("draft-active", ["preview", "ready", "offered", "queued", "playing"].includes(draft.status));
  });
}

function resetRuntime(): void {
  state.activeSceneId = "opening";
  state.currentBar = 0;
  state.currentBeat = 0;
  state.currentSixteenth = 0;
  state.focusedBrain = null;
  state.queue = [];
  state.history = [];
  state.lastAction = null;
  initialDrafts.forEach((draft) => { state.drafts[draft.id] = structuredClone(draft); });
  document.querySelectorAll<HTMLButtonElement>("[data-memory]").forEach((button) => { button.disabled = true; button.classList.remove("captured"); });
  document.querySelector<HTMLElement>("#memory-count")!.textContent = `0 / ${jamMemories.length}`;
  document.querySelector<HTMLElement>("#action-label")!.textContent = "Performance started";
  document.querySelector<HTMLElement>("#action-detail")!.textContent = "The four scripted brains are preparing their private drafts.";
  document.querySelector<HTMLElement>("#action-actor")!.textContent = "System";
  presentation.reset();
  activateScene(sceneForBar(0));
  renderState();
  updateTransportUi();
}

function finishPerformance(): void {
  captureAvailableMemories();
  startButton.textContent = "Performance complete";
  startButton.disabled = false;
  pauseButton.disabled = true;
  document.querySelector<HTMLElement>("#action-label")!.textContent = "Arrangement captured";
  document.querySelector<HTMLElement>("#action-detail")!.textContent = "The same 40-bar result can now be explained as four independent streams of musical decisions.";
  document.querySelector<HTMLElement>("#action-actor")!.textContent = "System";
}

function getButton(selector: string): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`${selector} not found`);
  return element;
}

window.addEventListener("beforeunload", () => audioEngine.dispose());
renderState();
updateTransportUi();
