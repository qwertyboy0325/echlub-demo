import type { CanonicalVsLiveComparison, ProductionSession } from "../domain/sessionTypes";

function renderTopologyStage(topologyText: string): string {
  const lines = topologyText.split("\n").filter(Boolean);
  return `
    <section class="topology-stage glass" id="topology-stage">
      <header><span class="eyebrow">Topology</span><h3>Production roles → performance capabilities</h3></header>
      <pre class="topology-summary">${lines.join("\n")}</pre>
    </section>`;
}

function sceneSpanBars(session: ProductionSession, sceneId: string): number {
  const scene = session.scenes.find((s) => s.id === sceneId);
  if (scene?.bars) return scene.bars;
  const ref = session.arrangement.scenes.find((r) => r.sceneId === sceneId);
  if (!ref) return 1;
  const next = session.arrangement.scenes.find((r) => r.startBar > ref.startBar);
  const end = next?.startBar ?? session.arrangement.totalBars;
  return Math.max(1, end - ref.startBar);
}

function renderSceneTimeline(
  label: string,
  session: ProductionSession,
  sceneIds: string[],
  changedSceneIds: Set<string>,
  variant: "canonical" | "live",
): string {
  const totalBars = session.arrangement.totalBars;
  const blocks = sceneIds.map((sceneId) => {
    const bars = sceneSpanBars(session, sceneId);
    const width = Math.max(4, (bars / totalBars) * 100);
    const scene = session.scenes.find((s) => s.id === sceneId);
    const changed = changedSceneIds.has(sceneId);
    return `
      <div class="comparison-scene-block ${changed ? "comparison-scene-changed" : ""}"
        style="--scene-width:${width}%"
        data-scene-id="${sceneId}"
        title="${scene?.title ?? sceneId} · ${bars} bars">
        <span>${scene?.title ?? sceneId}</span>
        <small>${bars}b</small>
      </div>`;
  }).join("");

  return `
    <article class="comparison-timeline comparison-timeline-${variant}">
      <header><span class="eyebrow">${label}</span><strong>${totalBars} bars · ${sceneIds.length} scenes</strong></header>
      <div class="comparison-scene-track">${blocks}</div>
    </article>`;
}

function renderClipChips(items: string[], className: string, emptyLabel: string): string {
  if (!items.length) {
    return `<div class="comparison-chip-row ${className}"><span class="comparison-chip comparison-chip-empty">${emptyLabel}</span></div>`;
  }
  return `
    <div class="comparison-chip-row ${className}">
      ${items.map((item) => `<span class="comparison-chip">${item}</span>`).join("")}
    </div>`;
}

export function renderComparisonView(
  comparison: CanonicalVsLiveComparison,
  canonicalSession: ProductionSession,
  liveSession: ProductionSession,
  topologyText?: string,
): string {
  const revisedClips = comparison.sameIdContentChanges.map(
    (c) => `${c.sceneId}/${c.layer} r${c.canonicalRevision}→r${c.liveRevision}`,
  );
  const replacedClips = comparison.changedDrafts;
  const structural = comparison.structuralChanges;
  const durationChanged = comparison.canonicalTotalBars !== comparison.liveTotalBars;
  const sceneOrderChanged = comparison.changedScenes.length > 0;
  const hasStructuralDivergence = structural.length > 0 || durationChanged || sceneOrderChanged;

  const changedSceneSet = new Set([
    ...comparison.changedScenes,
    ...structural.map((entry) => entry.match(/Held (\S+)/)?.[1]).filter(Boolean) as string[],
    ...structural.map((entry) => entry.match(/Extended (\S+)/)?.[1]).filter(Boolean) as string[],
  ]);

  const structuralSummary = hasStructuralDivergence
    ? structural.length
      ? structural.map((s) => `<li>${s}</li>`).join("")
      : [
          durationChanged ? `<li>Duration ${comparison.canonicalTotalBars} → ${comparison.liveTotalBars} bars</li>` : "",
          sceneOrderChanged ? `<li>Scene order changed: ${comparison.changedScenes.join(", ")}</li>` : "",
        ].filter(Boolean).join("")
    : "<li>No structural divergence</li>";

  const fxSummary = comparison.changedFx.length
    ? comparison.changedFx.map((fx) => `<span class="comparison-chip">${fx}</span>`).join("")
    : `<span class="comparison-chip comparison-chip-empty">No mix/FX delta</span>`;

  return `
    <section class="comparison-view glass" id="comparison-stage">
      <header class="comparison-header">
        <span class="eyebrow">Comparison</span>
        <h3>Canonical vs Collaborative Live Take</h3>
      </header>

      <div class="comparison-board">
        <div class="comparison-timelines">
          ${renderSceneTimeline("Canonical", canonicalSession, comparison.canonicalSceneIds, new Set(), "canonical")}
          <div class="comparison-arrow-row" aria-hidden="true">↓ live divergence</div>
          ${renderSceneTimeline("Live Take", liveSession, comparison.liveSceneIds, changedSceneSet, "live")}
        </div>

        <section class="comparison-structural-panel ${hasStructuralDivergence ? "comparison-has-divergence" : ""}"
          id="comparison-structural-difference" data-has-divergence="${hasStructuralDivergence}">
          <header><span class="eyebrow">Structural Changes</span></header>
          <ul class="comparison-structural-list">${structuralSummary}</ul>
        </section>

        <div class="comparison-metrics">
          <article class="comparison-metric-card">
            <h4>Revised Clips</h4>
            ${renderClipChips(revisedClips, "comparison-revised-clips", "No revised clips")}
          </article>
          <article class="comparison-metric-card">
            <h4>Replaced Clips</h4>
            ${renderClipChips(replacedClips, "comparison-replaced-clips", "No replaced clips")}
          </article>
          <article class="comparison-metric-card">
            <h4>Duration</h4>
            <p class="comparison-duration">${comparison.canonicalTotalBars} bars → ${comparison.liveTotalBars} bars</p>
          </article>
          <article class="comparison-metric-card">
            <h4>Jam Memories</h4>
            <p class="comparison-jam-count">${comparison.jamMemoryCount}</p>
          </article>
          <article class="comparison-metric-card comparison-metric-fx">
            <h4>Mix / FX</h4>
            <div class="comparison-chip-row">${fxSummary}</div>
          </article>
        </div>
      </div>
    </section>${topologyText ? renderTopologyStage(topologyText) : ""}`;
}

export function renderComparisonPanelFromSummary(summary: string, topologyText?: string): string {
  return `
    <section class="comparison-view glass" id="comparison-stage">
      <header><span class="eyebrow">Comparison</span><h3>Canonical vs Live Take</h3></header>
      <pre class="comparison-summary">${summary}</pre>
    </section>${topologyText ? renderTopologyStage(topologyText) : ""}`;
}
