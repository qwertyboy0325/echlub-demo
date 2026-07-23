import type { ProductionSession } from "../domain/sessionTypes";
import { abbreviateFingerprint } from "../domain/sessionMaterialBank";
import type { LayerId } from "../types";

export function renderArrangementView(session: ProductionSession, currentBar: number): string {
  const totalBars = session.arrangement.totalBars;
  const progress = Math.min(100, (currentBar / Math.max(1, totalBars)) * 100);
  const sceneRefs = session.arrangement.scenes;
  const activeRef = [...sceneRefs].reverse().find((s) => currentBar >= s.startBar);
  const activeScene = activeRef ? session.scenes.find((s) => s.id === activeRef.sceneId) : undefined;
  const nextRef = sceneRefs.find((s) => s.startBar > currentBar);
  const nextScene = nextRef ? session.scenes.find((s) => s.id === nextRef.sceneId) : undefined;

  const lanes = session.tracks.map((track) => {
    const blocks = sceneRefs.map((ref) => {
      const scene = session.scenes.find((s) => s.id === ref.sceneId);
      if (!scene) return "";
      const layer = track.layerKind as LayerId;
      const refMat = scene.layers[layer];
      const widthPct = ((scene.bars / totalBars) * 100).toFixed(2);
      const leftPct = ((ref.startBar / totalBars) * 100).toFixed(2);
      const isActive = activeRef?.sceneId === ref.sceneId;
      return `
        <div class="arr-block status-${refMat ? "pinned" : "empty"} ${isActive ? "arr-block-active" : ""}"
          style="left:${leftPct}%;width:${widthPct}%"
          data-arr-scene="${ref.sceneId}" data-arr-track="${track.id}">
          <span>${scene.title}</span>
          <small>${refMat ? `r${refMat.revision}` : "—"}</small>
        </div>`;
    }).join("");
    return `
      <div class="arr-lane" data-arr-lane="${track.id}">
        <div class="arr-lane-label"><span>${track.label}</span></div>
        <div class="arr-lane-track">${blocks}</div>
      </div>`;
  }).join("");

  const sectionMarkers = sceneRefs.map((ref) => {
    const scene = session.scenes.find((s) => s.id === ref.sceneId);
    const leftPct = ((ref.startBar / totalBars) * 100).toFixed(2);
    return `<div class="arr-section-marker" style="left:${leftPct}%"><span>${scene?.title ?? ref.sceneId}</span></div>`;
  }).join("");

  const layerSummary = activeScene
    ? (Object.entries(activeScene.layers) as [LayerId, import("../types").MaterialRef | null][])
      .filter(([, ref]) => ref)
      .map(([layer, ref]) => `<span class="arr-layer-chip">${layer} r${ref!.revision} ${abbreviateFingerprint(ref!.fingerprint)}</span>`)
      .join("")
    : "";

  return `
    <section class="arrangement-view" id="arrangement-view">
      <header class="arrangement-header">
        <div>
          <span class="eyebrow">Arrangement</span>
          <h3>${activeScene?.title ?? session.arrangement.title}</h3>
        </div>
        <div class="arrangement-meta">
          <span class="pill">bar ${currentBar + 1} / ${totalBars}</span>
          <span class="pill">next: ${nextScene?.title ?? "End"}</span>
        </div>
      </header>
      <div class="arrangement-timeline" style="--arr-progress:${progress}%">
        <div class="arr-playhead" style="left:${progress}%"></div>
        <div class="arr-sections">${sectionMarkers}</div>
        <div class="arr-lanes">${lanes}</div>
      </div>
      <footer class="arrangement-footer">${layerSummary || "<em>Session clips expand into timeline blocks</em>"}</footer>
    </section>`;
}
