import type { ProductionSession } from "../domain/sessionTypes";
import type { DemoDirector } from "../demo/demoDirector";
import { formatProductionRole } from "../domain/draftAuthorship";
import { assignmentsForView, getActivePerformanceView } from "../domain/performanceModel";

export interface ParticipantRailOptions {
  emphasizeIds?: Set<string>;
}

export function renderParticipantRail(
  session: ProductionSession,
  director: DemoDirector,
  options: ParticipantRailOptions = {},
): string {
  const focus = director.getFocusState();
  const activeView = getActivePerformanceView(session.performanceConfig);
  const assignments = assignmentsForView(session.performanceConfig, activeView);
  const capabilityByParticipant = new Map(
    assignments.map((a) => [a.participantId, a.capabilityId]),
  );

  const chips = session.participants.map((p) => {
    const isFocused = focus.collaboratorRailIds.length
      ? focus.collaboratorRailIds.some((wsId) => {
          const ws = session.workspaces.find((w) => w.id === wsId);
          return ws?.participantId === p.id;
        })
      : focus.focusedWorkspaceIds.some((wsId) => {
          const ws = session.workspaces.find((w) => w.id === wsId);
          return ws?.participantId === p.id;
        });
    const emphasize = options.emphasizeIds?.has(p.id) ?? isFocused;
    const capId = capabilityByParticipant.get(p.id);
    const cap = session.performanceConfig.capabilities.find((c) => c.id === capId);
    const initial = p.displayName.charAt(0).toUpperCase();
    return `
      <button type="button" class="participant-chip ${emphasize ? "participant-active" : ""}"
        data-participant-id="${p.id}" title="${p.displayName} · ${p.roleId}${cap ? ` · ${cap.label}` : ""}">
        <span class="participant-avatar" style="--chip-color:${cap?.color ?? "#929caf"}">${initial}</span>
        <span class="participant-meta">
          <strong>${p.displayName}</strong>
          <small>${formatProductionRole(p.roleId)}${cap ? ` · ${cap.label}` : ""}</small>
        </span>
      </button>`;
  }).join("");

  return `
    <aside class="participant-rail" id="participant-rail" aria-label="Participants">
      <header><span class="eyebrow">Participants</span><span class="pill">${session.participants.length}</span></header>
      <div class="participant-chip-list">${chips}</div>
    </aside>`;
}
