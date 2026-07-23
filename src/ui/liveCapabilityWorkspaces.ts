import type { ProductionSession } from "../domain/sessionTypes";
import type { BrainId, RuntimeState } from "../types";
import { draftIdsForCapability, resolveCapabilityOperationContext } from "../domain/capabilityOperations";
import { participantsForCapability } from "../domain/performanceModel";

export interface LiveWorkspaceContext {
  session: ProductionSession;
  state: RuntimeState;
  previewBrain: BrainId | null;
}

export function renderLowEndWorkspace(ctx: LiveWorkspaceContext): string {
  const ctxResolved = resolveCapabilityOperationContext(ctx.session, "cap-lowend");
  const draftIds = draftIdsForCapability(ctx.session, "cap-lowend");
  const activeId = ctx.state.activeDraftId && draftIds.includes(ctx.state.activeDraftId)
    ? ctx.state.activeDraftId
    : ctxResolved?.draftId ?? draftIds[0] ?? "";
  const draft = activeId ? ctx.state.drafts[activeId] : undefined;
  const tabs = draftIds.map((id) => {
    const d = ctx.state.drafts[id];
    if (!d) return "";
    return `<button class="mini ${id === activeId ? "active" : ""} status-${d.status}" data-draft-tab="${id}" data-target="${id}">${d.title}</button>`;
  }).join("");
  const notes = (draft?.notes ?? []).map((n) =>
    `<div class="piano-note status-${draft?.status ?? "editing"}" data-note-id="${n.id}" style="--step:${n.step};--pitch:${n.pitch}"><span>${n.note}</span></div>`,
  ).join("");
  const operators = participantsForCapability(ctx.session.performanceConfig, "cap-lowend", ctx.session.participants)
    .map((p) => p.displayName).join(" · ");
  return `
    <div class="capability-toolbar"><span class="eyebrow">Low End · ${operators}</span></div>
    <div class="workspace-toolbar">${tabs}</div>
    <div class="piano-roll brain-primary-target capability-primary-target" data-target="lowend-grid" data-capability-workspace="cap-lowend" data-active-draft="${activeId}">
      <div class="piano-grid">${notes || "<em class=\"empty\">Select bass draft</em>"}</div>
    </div>
    <div class="workspace-actions">
      <button type="button" data-target="lowend-private-cue" data-capability-cue="cap-lowend">Private cue bass</button>
      <button type="button" data-target="lowend-offer" data-capability-offer="cap-lowend">Offer bass revision</button>
    </div>`;
}

export function renderHarmonyWorkspace(ctx: LiveWorkspaceContext): string {
  const ctxResolved = resolveCapabilityOperationContext(ctx.session, "cap-harmony");
  const draftIds = draftIdsForCapability(ctx.session, "cap-harmony");
  const activeId = ctxResolved?.draftId ?? draftIds[0] ?? "";
  const draft = activeId ? ctx.state.drafts[activeId] : undefined;
  const chords = (draft?.harmonyChords ?? []).slice(0, 6).map((c, i) =>
    `<div class="chord-block" data-chord-idx="${i}" data-target="harmony-chord-${i}"><strong>${c.notes.join(" ")}</strong><small>bar ${c.bar + 1}</small></div>`,
  ).join("");
  const operators = participantsForCapability(ctx.session.performanceConfig, "cap-harmony", ctx.session.participants)
    .map((p) => p.displayName).join(" · ");
  return `
    <div class="capability-toolbar"><span class="eyebrow">Harmony · ${operators}</span></div>
    <div class="draft-chords capability-primary-target" data-target="harmony-grid" data-capability-workspace="cap-harmony" data-active-draft="${activeId}">
      ${chords || "<em>No chords</em>"}
    </div>
    <div class="workspace-actions">
      <button type="button" data-target="harmony-private-cue" data-capability-cue="cap-harmony">Private cue harmony</button>
      <button type="button" data-target="harmony-voice" data-capability-offer="cap-harmony">Voice next chord</button>
    </div>`;
}

export function renderCapabilityWorkspace(
  capabilityId: string,
  ctx: LiveWorkspaceContext,
  legacyRender?: (brain: BrainId) => string,
  legacyBrainId?: BrainId,
): string {
  if (legacyBrainId && legacyRender) return legacyRender(legacyBrainId);
  if (capabilityId === "cap-lowend") return renderLowEndWorkspace(ctx);
  if (capabilityId === "cap-harmony") return renderHarmonyWorkspace(ctx);
  const participants = participantsForCapability(ctx.session.performanceConfig, capabilityId, ctx.session.participants);
  return `<div class="capability-placeholder" data-capability-workspace="${capabilityId}">${participants.map((p) => p.displayName).join(", ")}</div>`;
}

export function capabilityIdsNeedingRefresh(session: ProductionSession): string[] {
  const view = session.performanceConfig.views.find((v) => v.id === session.performanceConfig.activeViewId)
    ?? session.performanceConfig.views[0];
  return view?.capabilityIds ?? [];
}
