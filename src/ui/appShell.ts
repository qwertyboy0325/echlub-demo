import type { DemoAct } from "../domain/sessionTypes";

export interface AppShellContext {
  act: DemoAct | "idle";
  experienceStarted: boolean;
  recordingMode: boolean;
  isPublicSongDemo: boolean;
  metadata: {
    title: string;
    bpm: number;
    totalBars: number;
    packLabel: string;
  };
  topbarExtra?: string;
  launcherHtml: string;
  transportHtml: string;
  participantRailHtml: string;
  trackListHtml: string;
  mainWorkspaceHtml: string;
  inspectorHtml: string;
  clipDetailHtml: string;
  footerHtml: string;
  performanceOverlayHtml?: string;
  comparisonHtml?: string;
}

export function renderAppShell(ctx: AppShellContext): string {
  const showArrangement = ctx.act === "canonicalPlayback";
  const showPerformance = ctx.act === "livePerformance" || ctx.act === "comparison";
  const showComparison = ctx.act === "comparison";

  return `
  <main class="app-shell daw-shell ${ctx.recordingMode ? "recording-mode" : ""}"
    data-act="${ctx.act}" data-experience-started="${ctx.experienceStarted}">
    <header class="topbar glass daw-topbar">
      <div class="brand-block">
        <div class="brand-mark">E</div>
        <div>
          <div class="eyebrow">EchLub Collaborative DAW</div>
          <h1>${ctx.isPublicSongDemo ? "Shiki No Uta · Collaborative Lab" : "Concept Film Runtime"}</h1>
          <p>Shared materials → canonical arrangement → configurable live recomposition</p>
        </div>
      </div>
      <div class="daw-transport-pills header-status">
        <span class="pill" id="bpm-label">${ctx.metadata.bpm} BPM</span>
        <span class="pill" id="total-bars-label">${ctx.metadata.totalBars} bars</span>
        <span class="pill" id="pack-label">${ctx.metadata.packLabel}</span>
        <span class="pill status-ready" id="audio-status">audio locked</span>
        ${ctx.topbarExtra ?? ""}
      </div>
    </header>

    ${ctx.launcherHtml}

    <section class="daw-workspace glass" id="daw-workspace">
      <div class="daw-workspace-grid">
        <div class="daw-left-rail">
          ${ctx.trackListHtml}
          ${ctx.participantRailHtml}
        </div>
        <div class="daw-main ${showArrangement ? "daw-main-arrangement" : showComparison ? "daw-main-comparison" : "daw-main-session"}">
          ${ctx.mainWorkspaceHtml}
        </div>
        <div class="daw-right-rail">
          ${ctx.inspectorHtml}
        </div>
      </div>
      ${showPerformance && ctx.performanceOverlayHtml
    ? `<div class="daw-live-dock" id="daw-live-dock">${ctx.performanceOverlayHtml}</div>`
    : ""}
      <div class="daw-clip-detail ${showPerformance || showComparison ? "daw-clip-detail-secondary" : ""}">
        ${ctx.clipDetailHtml}
      </div>
    </section>

    ${ctx.transportHtml}

    <section class="action-strip glass" id="action-strip">
      <div class="section-heading">
        <div><span class="eyebrow">Action</span><h3 id="action-label">No action yet</h3></div>
        <span class="action-actor" id="action-actor">—</span>
      </div>
      <p id="action-detail">Collaborative edits update clip revisions, scene placement and what you hear.</p>
      <div class="pipeline">
        <span data-state="editing">Editing</span><b>→</b>
        <span data-state="preview">Private preview</span><b>→</b>
        <span data-state="offered">Offered</span><b>→</b>
        <span data-state="queued">Queued</span><b>→</b>
        <span data-state="playing">Playing</span>
      </div>
    </section>

    <article class="glass jam-memory daw-jam-memory" id="jam-memory-panel">
      <div class="section-heading"><div><span class="eyebrow">Jam Memory</span><h3>Captured structural moments</h3></div><span id="memory-count">0 / 0</span></div>
      <div class="memory-list" id="memory-list"></div>
    </article>

    <footer class="demo-footer">${ctx.footerHtml}</footer>
  </main>`;
}

export function renderTrackList(tracks: { id: string; label: string; layerKind: string }[]): string {
  return `
    <aside class="track-list-rail" id="track-list-rail">
      <header><span class="eyebrow">Tracks</span><span class="pill">${tracks.length}</span></header>
      <ul class="track-list">
        ${tracks.map((t) => `<li data-track-id="${t.id}"><span>${t.label}</span><small>${t.layerKind}</small></li>`).join("")}
      </ul>
    </aside>`;
}

export function renderTransportStrip(ctx: {
  sceneTitle: string;
  sceneDescription: string;
  position: string;
  nextScene: string;
  queueCount: string;
  provenance: string;
  sceneCardsHtml: string;
  masterGridHtml: string;
  boundaryHtml: string;
}): string {
  return `
    <section class="master-stage glass daw-transport-strip" id="daw-transport-strip">
      <div class="master-copy">
        <div class="eyebrow">TRANSPORT</div>
        <h2 id="scene-title">${ctx.sceneTitle}</h2>
        <p id="scene-description">${ctx.sceneDescription}</p>
        ${ctx.boundaryHtml}
      </div>
      <div class="transport-readout">
        <div><span>Position</span><strong id="position">${ctx.position}</strong></div>
        <div><span>Next</span><strong id="next-scene">${ctx.nextScene}</strong></div>
        <div><span>Queued</span><strong id="queue-count">${ctx.queueCount}</strong></div>
        <div><span>Provenance</span><strong id="provenance-label">${ctx.provenance}</strong></div>
      </div>
      <div class="step-grid" id="master-grid">${ctx.masterGridHtml}</div>
      <div class="scene-timeline">${ctx.sceneCardsHtml}</div>
    </section>`;
}
