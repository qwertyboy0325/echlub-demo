import type { BrainId, RuntimeState } from "../types";
import type { ProductionSession } from "../domain/sessionTypes";
import {
  getActivePerformanceView,
  participantsForCapability,
} from "../domain/performanceModel";
import { renderCapabilityWorkspace, type LiveWorkspaceContext } from "./liveCapabilityWorkspaces";

export interface CapabilityPanelContent {
  capabilityId: string;
  legacyBrainId?: BrainId;
  innerHtml: string;
}

export interface PerformanceOverlayContext {
  session: ProductionSession;
  state: RuntimeState;
  panels: CapabilityPanelContent[];
  viewLabel?: string;
}

const CAPABILITY_SYMBOLS: Record<string, string> = {
  "cap-material": "M",
  "cap-rhythm": "R",
  "cap-mixfx": "X",
  "cap-structure": "S",
  "cap-lowend": "L",
  "cap-harmony": "H",
  "cap-lead": "A",
};

export function renderPerformanceOverlay(ctx: PerformanceOverlayContext): string {
  const view = getActivePerformanceView(ctx.session.performanceConfig);
  const capabilities = view.capabilityIds
    .map((id) => ctx.session.performanceConfig.capabilities.find((c) => c.id === id))
    .filter(Boolean);

  const panels = capabilities.map((cap) => {
    const panelContent = ctx.panels.find((p) => p.capabilityId === cap!.id);
    const legacyBrain = cap!.legacyBrainId;
    const participants = participantsForCapability(ctx.session.performanceConfig, cap!.id, ctx.session.participants);
    const symbol = CAPABILITY_SYMBOLS[cap!.id] ?? cap!.label.charAt(0).toUpperCase();
    const brainAttr = legacyBrain ? `data-brain="${legacyBrain}"` : `data-capability="${cap!.id}"`;
    const stateLabel = legacyBrain
      ? ctx.state.activeBrains.has(legacyBrain) ? "active" : "idle"
      : "ready";
    const thought = legacyBrain ? ctx.state.thoughts[legacyBrain] : participants.map((p) => p.displayName).join(" · ");

    return `
      <article class="capability-panel glass ${legacyBrain ? "brain-window" : ""}" ${brainAttr}>
        <div class="brain-header capability-header">
          <div class="brain-id capability-mark" style="background:linear-gradient(135deg,${cap!.color ?? "#929caf"},#a78bfa)">${symbol}</div>
          <div>
            <span class="eyebrow">LIVE · ${cap!.label.toUpperCase()}</span>
            <h3>${cap!.label}</h3>
            <p>${cap!.description ?? participants.map((p) => p.displayName).join(", ")}</p>
          </div>
          <span class="brain-state" id="${legacyBrain ?? cap!.id}-state">${stateLabel}</span>
        </div>
        <div class="brain-workspace capability-workspace">${panelContent?.innerHtml ?? renderCapabilityWorkspace(cap!.id, { session: ctx.session, state: ctx.state, previewBrain: ctx.state.previewBrain })}</div>
        <div class="thought-strip"><span>activity</span><p id="${legacyBrain ?? cap!.id}-thought">${thought}</p></div>
        ${legacyBrain
    ? `<div class="virtual-cursor" data-cursor="${legacyBrain}"><i></i><b>${symbol}</b></div>`
    : `<div class="virtual-cursor capability-cursor" data-capability-cursor="${cap!.id}"><i></i><b>${symbol}</b></div>`}
      </article>`;
  }).join("");

  return `
    <section class="performance-overlay" id="performance-overlay" data-view-id="${view.id}" data-capability-count="${capabilities.length}">
      <header class="performance-overlay-header">
        <span class="eyebrow">Live Performance</span>
        <h3>${ctx.viewLabel ?? view.label}</h3>
        <span class="pill">${capabilities.length} capabilities · ${ctx.session.participants.length} participants</span>
      </header>
      <div class="capability-grid" style="--cap-count:${capabilities.length}">${panels}</div>
    </section>`;
}

export function legacyBrainPanelsFromState(
  session: ProductionSession,
  renderWorkspace: (brain: BrainId) => string,
  ctx?: LiveWorkspaceContext,
): CapabilityPanelContent[] {
  const view = getActivePerformanceView(session.performanceConfig);
  const workspaceCtx = ctx ?? { session, state: { previewBrain: null } as LiveWorkspaceContext["state"], previewBrain: null };
  return view.capabilityIds.map((capId) => {
    const cap = session.performanceConfig.capabilities.find((c) => c.id === capId)!;
    return {
      capabilityId: capId,
      legacyBrainId: cap.legacyBrainId,
      innerHtml: renderCapabilityWorkspace(capId, workspaceCtx, renderWorkspace, cap.legacyBrainId),
    };
  });
}

export function fourCapabilityPresetAvailable(session: ProductionSession): boolean {
  return session.performanceConfig.views.some((v) => v.legacyPreset === "four-capability");
}
