import type { ProductionSession } from "../domain/sessionTypes";
import type { DemoDirector } from "./demoDirector";
import { abbreviateFingerprint } from "../domain/sessionMaterialBank";
import type { LayerId } from "../types";

export function renderProductionRail(session: ProductionSession, director: DemoDirector): string {
  const focus = director.getFocusState();
  const defaultFocusId = session.workspaces[0]?.id;
  const focused = new Set(focus.focusedWorkspaceIds.length ? focus.focusedWorkspaceIds : defaultFocusId ? [defaultFocusId] : []);
  const rail = new Set(focus.collaboratorRailIds);

  const cards = session.workspaces
    .sort((a, b) => a.focusPriority - b.focusPriority)
    .map((ws) => {
      const participant = session.participants.find((p) => p.id === ws.participantId);
      const isFocused = focused.has(ws.id);
      const isRail = rail.has(ws.id);
      const draftPreview = isFocused ? renderWorkspaceDraftPreview(session, ws.trackIds) : "";
      return `
        <article class="production-workspace ${isFocused ? "workspace-focused" : ""} ${isRail ? "workspace-rail" : ""}"
          data-workspace-id="${ws.id}">
          <header>
            <span class="participant-name">${participant?.displayName ?? ws.participantId}</span>
            <small>${ws.label}</small>
          </header>
          <div class="workspace-tracks">
            ${ws.trackIds.map((tid) => {
              const track = session.tracks.find((t) => t.id === tid);
              return track ? `<span class="track-chip">${track.label}</span>` : "";
            }).join("")}
          </div>
          ${draftPreview}
        </article>`;
    })
    .join("");

  const collaborators = session.participants
    .map((p) => `<span class="collaborator-chip" data-participant="${p.id}">${p.displayName}</span>`)
    .join("");

  const mixSummary = `filter ${Math.round(session.mix.filter)} · delay ${Math.round(session.mix.delayWet * 100)}%`;

  return `
    <section class="production-stage glass" id="production-stage">
      <div class="section-heading">
        <div><span class="eyebrow">ACT 1 · PRODUCTION</span><h3 id="act-label">${focus.actLabel}</h3></div>
        <span class="pill">${session.participants.length} creators · ${session.tracks.length} tracks</span>
      </div>
      <div class="collaborator-rail">${collaborators}</div>
      <div class="production-workspaces">${cards}</div>
      <div class="mix-preview"><span class="eyebrow">Mix / FX</span><span>${mixSummary}</span></div>
      <div class="arrangement-preview">
        <span class="eyebrow">Arrangement assembly</span>
        <div class="arrangement-chips">
          ${session.arrangement.scenes.map((s) => `<span class="arr-chip">${s.sceneId}@${s.startBar}</span>`).join("") || '<em class="empty">incomplete</em>'}
        </div>
      </div>
    </section>`;
}

function renderWorkspaceDraftPreview(session: ProductionSession, trackIds: string[]): string {
  const draftIds = trackIds.flatMap((tid) => session.tracks.find((t) => t.id === tid)?.draftIds ?? []);
  const previews = draftIds.slice(0, 2).map((did) => {
    const d = session.drafts[did];
    if (!d) return "";
    if (d.kind === "drums" && d.steps?.length) {
      return `<div class="draft-grid" data-draft="${did}">steps: ${d.steps.join(",")} r${d.revision}</div>`;
    }
    if ((d.kind === "melody" || d.kind === "bass") && d.notes?.length) {
      return `<div class="draft-lane" data-draft="${did}">${d.notes.map((n) => n.note).join(" ")} r${d.revision}</div>`;
    }
    if (d.kind === "harmony" && d.harmonyChords?.length) {
      return `<div class="draft-chords" data-draft="${did}">${d.harmonyChords.length} chords r${d.revision}</div>`;
    }
    if (d.kind === "texture" && d.textureParams) {
      return `<div class="draft-texture" data-draft="${did}">${d.textureParams.patchId} lvl${d.textureParams.level} r${d.revision}</div>`;
    }
    return `<div class="draft-empty" data-draft="${did}">r${d.revision}</div>`;
  });
  return previews.length ? `<div class="draft-previews">${previews.join("")}</div>` : "";
}

export function renderCanonicalStage(session: ProductionSession, currentBar: number): string {
  const scene = [...session.arrangement.scenes].reverse().find((s) => currentBar >= s.startBar);
  const active = scene ? session.scenes.find((s) => s.id === scene.sceneId) : undefined;
  const nextRef = session.arrangement.scenes.find((s) => s.startBar > currentBar);
  const next = nextRef ? session.scenes.find((s) => s.id === nextRef.sceneId) : undefined;

  const layerRows = active
    ? (Object.entries(active.layers) as [LayerId, import("../types").MaterialRef | null][])
      .map(([layer, ref]) => {
        if (!ref) return `<tr><td>${layer}</td><td colspan="3"><em>silence</em></td></tr>`;
        return `<tr><td>${layer}</td><td>${ref.draftId}</td><td>r${ref.revision}</td><td>${abbreviateFingerprint(ref.fingerprint)}</td></tr>`;
      }).join("")
    : "";

  return `
    <section class="canonical-stage glass" id="canonical-stage">
      <div class="section-heading">
        <div><span class="eyebrow">ACT 2 · CANONICAL PLAYBACK</span><h3>${active?.title ?? "—"}</h3></div>
        <span class="pill">bar ${currentBar + 1}</span>
      </div>
      <div class="canonical-meta">
        <div><span>Next scene</span><strong>${next?.title ?? "Ending"}</strong></div>
        <div><span>Mix filter</span><strong>${Math.round(active?.fx.filter ?? session.mix.filter)} Hz</strong></div>
      </div>
      <table class="canonical-tracks">
        <thead><tr><th>Layer</th><th>Draft</th><th>Rev</th><th>FP</th></tr></thead>
        <tbody>${layerRows || "<tr><td colspan='4'>—</td></tr>"}</tbody>
      </table>
    </section>`;
}

export function renderComparisonPanel(summary: string): string {
  return `
    <section class="comparison-stage glass" id="comparison-stage">
      <div class="section-heading">
        <div><span class="eyebrow">ACT 4 · COMPARISON</span><h3>Canonical Reconstruction vs Collaborative Live Take</h3></div>
      </div>
      <pre class="comparison-summary">${summary}</pre>
    </section>`;
}

export function renderTopologyPanel(session: ProductionSession): string {
  const view = session.performanceViews[0];
  const brains = view?.brainOrder ?? [];
  const capabilityTitles: Record<string, string> = {
    memory: "Material Deck",
    pulse: "Rhythm Deck",
    blend: "Mixer / FX",
    story: "Scene Launcher",
  };
  const grouped = brains.map((brain) => {
    const participants = session.participants.filter((participant) => participant.performanceBrain === brain);
    return `<article class="topology-brain" data-topology-brain="${brain}">
      <span class="topology-brain-mark">${brain.charAt(0).toUpperCase()}</span>
      <div><strong>${capabilityTitles[brain] ?? brain}</strong>
      <small>${participants.map((participant) => participant.displayName).join(" + ") || "capability view"}</small></div>
    </article>`;
  }).join("");
  return `
    <section class="topology-stage glass" id="topology-stage">
      <div class="section-heading">
        <div><span class="eyebrow">TOPOLOGY TRANSFORMATION</span><h3>Production roles → Performance capabilities</h3></div>
        <span class="pill">8 production roles · 4 DJ capabilities</span>
      </div>
      <div class="topology-flow">
        <div class="topology-role-list">
          ${session.participants.map((participant) => `<span>${participant.displayName}</span>`).join("")}
        </div>
        <div class="topology-arrow" aria-hidden="true">regroup<br>→</div>
        <div class="topology-brain-grid">${grouped}</div>
      </div>
      <p class="topology-note">The people and authored materials remain intact; the live view regroups responsibilities into four performance capabilities.</p>
    </section>`;
}
