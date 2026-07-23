import type { ProductionSession } from "../domain/sessionTypes";
import type { RuntimeState } from "../types";
import { authorDisplayName, formatProductionRole, isDraftPrivatelyPreviewed, resolveDraftAuthor } from "../domain/draftAuthorship";

export interface CollaborationInspectorContext {
  session: ProductionSession;
  state: RuntimeState;
  selectedDraftId?: string;
}

export function renderCollaborationInspector(ctx: CollaborationInspectorContext): string {
  const { session, state, selectedDraftId } = ctx;
  const draftId = selectedDraftId ?? state.activeDraftId ?? state.offeredDrafts[0];
  const draft = draftId ? session.drafts[draftId] : undefined;
  const author = draft ? resolveDraftAuthor(session, draft) : undefined;
  const offered = state.offeredDrafts.map((id) => {
    const d = session.drafts[id];
    return `<li class="collab-offered" data-offered="${id}">${d?.title ?? id} <small>offered</small></li>`;
  }).join("");
  const queued = state.queue.filter((q) => q.status === "queued").map((q) =>
    `<li class="collab-queued" data-queue="${q.id}">${q.label} <small>bar ${q.executeAtBar + 1}</small></li>`,
  ).join("");
  const scenePlacement = draft
    ? session.scenes.find((s) =>
        Object.values(s.layers).some((ref) => ref?.draftId === draftId),
      )?.title
    : undefined;

  return `
    <aside class="collaboration-inspector" id="collaboration-inspector">
      <header><span class="eyebrow">Collaboration</span></header>
      ${draft ? `
        <dl class="collab-facts">
          <div><dt>Clip</dt><dd>${draft.title}</dd></div>
          <div><dt>Author</dt><dd>${authorDisplayName(session, draft)}</dd></div>
          <div><dt>Status</dt><dd class="status-${draft.status}">${draft.status}</dd></div>
          <div><dt>Revision</dt><dd>r${draft.revision}</dd></div>
          ${isDraftPrivatelyPreviewed(draft, state.previewBrain) ? "<div><dt>Preview</dt><dd class=\"collab-previewing\">Private preview active</dd></div>" : ""}
          <div><dt>Role</dt><dd>${author ? formatProductionRole(author.roleId) : "—"}</dd></div>
          ${scenePlacement ? `<div><dt>Scene</dt><dd>${scenePlacement}</dd></div>` : ""}
        </dl>
      ` : "<p class=\"collab-empty\">No clip selected</p>"}
      ${offered ? `<section class="collab-section"><h4>Offered</h4><ul>${offered}</ul></section>` : ""}
      ${queued ? `<section class="collab-section"><h4>Queued</h4><ul>${queued}</ul></section>` : ""}
      <section class="collab-pipeline">
        <span class="${draft?.status === "editing" ? "pipeline-active" : ""}">Editing</span>
        <span class="${draft?.status === "preview" ? "pipeline-active" : ""}">Preview</span>
        <span class="${draft?.status === "offered" ? "pipeline-active" : ""}">Offered</span>
        <span class="${draft?.status === "queued" ? "pipeline-active" : ""}">Queued</span>
        <span class="${draft?.status === "playing" ? "pipeline-active" : ""}">Playing</span>
      </section>
    </aside>`;
}
