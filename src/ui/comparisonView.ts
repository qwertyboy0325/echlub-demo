import type { CanonicalVsLiveComparison } from "../domain/sessionTypes";

function renderTopologyStage(topologyText: string): string {
  const lines = topologyText.split("\n").filter(Boolean);
  return `
    <section class="topology-stage glass" id="topology-stage">
      <header><span class="eyebrow">Topology</span><h3>Production roles → performance capabilities</h3></header>
      <pre class="topology-summary">${lines.join("\n")}</pre>
    </section>`;
}

export function renderComparisonView(comparison: CanonicalVsLiveComparison, topologyText?: string): string {
  const structural = comparison.structuralChanges.length
    ? comparison.structuralChanges.map((s) => `• ${s}`).join("\n")
    : "• No structural divergence";
  const content = comparison.sameIdContentChanges.length
    ? comparison.sameIdContentChanges.map((c) =>
        `• ${c.sceneId}/${c.layer}: r${c.canonicalRevision} → r${c.liveRevision}`,
      ).join("\n")
    : "• Layer revisions match canonical";

  const summary = `
Canonical scenes: ${comparison.canonicalSceneIds.length}
Live scenes played: ${comparison.liveSceneIds.length}
Changed scenes: ${comparison.changedScenes.join(", ") || "none"}
Changed drafts: ${comparison.changedDrafts.join(", ") || "none"}
Bars: ${comparison.canonicalTotalBars} → ${comparison.liveTotalBars}
Jam memories: ${comparison.jamMemoryCount}

Structural changes:
${structural}

Content deltas:
${content}
`.trim();

  return `
    <section class="comparison-view glass" id="comparison-stage">
      <header class="comparison-header">
        <span class="eyebrow">Comparison</span>
        <h3>Canonical vs Collaborative Live Take</h3>
      </header>
      <div class="comparison-visual">
        <article class="comparison-card comparison-canonical">
          <h4>Canonical</h4>
          <p>${comparison.canonicalTotalBars} bars · ${comparison.canonicalSceneIds.length} scenes</p>
        </article>
        <div class="comparison-arrow" aria-hidden="true">→</div>
        <article class="comparison-card comparison-live">
          <h4>Live Take</h4>
          <p>${comparison.liveTotalBars} bars · ${comparison.changedScenes.length} scene changes</p>
        </article>
      </div>
      <pre class="comparison-summary">${summary}</pre>
    </section>${topologyText ? renderTopologyStage(topologyText) : ""}`;
}

export function renderComparisonPanelFromSummary(summary: string, topologyText?: string): string {
  return `
    <section class="comparison-view glass" id="comparison-stage">
      <header><span class="eyebrow">Comparison</span><h3>Canonical vs Live Take</h3></header>
      <pre class="comparison-summary">${summary}</pre>
    </section>${topologyText ? renderTopologyStage(topologyText) : ""}`;
}
