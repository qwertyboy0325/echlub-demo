import type { ProductionSession } from "../domain/sessionTypes";
import type { DemoDirector } from "../demo/demoDirector";
import type { RuntimeState } from "../types";
import { authorColorForParticipant, resolveDraftAuthor } from "../domain/draftAuthorship";

export interface SessionViewContext {
  session: ProductionSession;
  director: DemoDirector;
  state: RuntimeState;
  selectedDraftId?: string;
  selectedSceneId?: string;
}

export function renderSessionView(ctx: SessionViewContext): string {
  const { session, state } = ctx;
  const sceneIds = session.scenes.map((s) => s.id);
  const trackHeaders = session.tracks.map((t) =>
    `<th class="track-header" data-track-id="${t.id}"><span>${t.label}</span><small>${t.layerKind}</small></th>`,
  ).join("");

  const rows = session.scenes.map((scene) => {
    const isActive = scene.id === state.activeSceneId;
    const isQueued = state.queue.some((q) => q.sceneId === scene.id && q.status === "queued");
    const cells = session.tracks.map((track) => {
      const draftId = track.draftIds.find((id) => {
        const layer = track.layerKind as keyof typeof scene.layers;
        const ref = scene.layers[layer as "drums" | "bass" | "harmony" | "melody" | "texture"];
        return ref?.draftId === id;
      }) ?? track.draftIds[0];
      const draft = draftId ? session.drafts[draftId] : undefined;
      const status = draft?.status ?? "editing";
      const author = draft ? resolveDraftAuthor(session, draft) : undefined;
      const authorColor = authorColorForParticipant(session, author);
      return `
        <td class="clip-slot status-${status} ${draftId === ctx.selectedDraftId ? "clip-selected" : ""}"
          data-scene-id="${scene.id}" data-track-id="${track.id}" data-draft-id="${draftId ?? ""}">
          <div class="clip-block" style="--author-color:${authorColor}">
            <span class="clip-title">${draft?.title ?? "—"}</span>
            <span class="clip-meta">r${draft?.revision ?? 0}${author ? ` · ${author.displayName.split(" ")[0]}` : ""}</span>
          </div>
        </td>`;
    }).join("");
    return `
      <tr class="scene-row ${isActive ? "scene-active" : ""} ${isQueued ? "scene-queued" : ""}" data-scene-row="${scene.id}">
        <th class="scene-launch">
          <button type="button" class="scene-launch-btn" data-scene-launch="${scene.id}">
            <span>${String(scene.startBar + 1).padStart(2, "0")}</span>
            <strong>${scene.title}</strong>
          </button>
        </th>
        ${cells}
      </tr>`;
  }).join("");

  return `
    <section class="session-view" id="session-view" data-scene-count="${sceneIds.length}">
      <header class="session-view-header">
        <span class="eyebrow">Session</span>
        <span class="pill">${session.tracks.length} tracks · ${session.scenes.length} scenes</span>
      </header>
      <div class="session-grid-wrap">
        <table class="session-grid" aria-label="Session grid">
          <thead><tr><th class="scene-col">Scene</th>${trackHeaders}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}
