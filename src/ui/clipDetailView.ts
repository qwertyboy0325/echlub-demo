import type { ProductionSession } from "../domain/sessionTypes";
import type { PatternDraft } from "../types";
import { authorDisplayName, formatProductionRole, isDraftPrivatelyPreviewed, resolveDraftAuthor } from "../domain/draftAuthorship";

export interface ClipDetailContext {
  session: ProductionSession;
  draftId: string | null;
  previewBrain: string | null;
}

function renderDrumEditor(draft: PatternDraft): string {
  const steps = draft.steps ?? [];
  const rows = ["Kick", "Snare", "Hat"].map((name, row) =>
    `<div class="seq-row"><span>${name}</span>${Array.from({ length: 16 }, (_, s) => {
      const on = row === 0 ? steps.includes(s) : row === 1 ? (s === 4 || s === 12) : s % 2 === 0 && steps.includes(s);
      return `<i class="${on ? "on" : ""}" data-seq-step="${row}-${s}"></i>`;
    }).join("")}</div>`,
  ).join("");
  return `<div class="clip-editor clip-editor-drums"><div class="sequencer">${rows}</div></div>`;
}

function renderPianoEditor(draft: PatternDraft): string {
  const notes = (draft.notes ?? []).map((n) =>
    `<div class="piano-note status-${draft.status}" data-note-id="${n.id}" style="--step:${n.step};--pitch:${n.pitch}"><span>${n.note}</span></div>`,
  ).join("");
  return `<div class="clip-editor clip-editor-piano"><div class="piano-roll"><div class="piano-grid">${notes}</div></div></div>`;
}

function renderHarmonyEditor(draft: PatternDraft): string {
  const chords = (draft.harmonyChords ?? []).map((c, i) =>
    `<div class="chord-block" data-chord-idx="${i}"><strong>${c.notes.join(" ")}</strong><small>bar ${c.bar + 1}</small></div>`,
  ).join("");
  return `<div class="clip-editor clip-editor-harmony">${chords || "<em>No chords yet</em>"}</div>`;
}

function renderTextureEditor(draft: PatternDraft): string {
  const p = draft.textureParams;
  if (!p) return `<div class="clip-editor clip-editor-texture"><em>No texture params</em></div>`;
  return `<div class="clip-editor clip-editor-texture">
    <div class="texture-knobs">
      <span>Patch <strong>${p.patchId}</strong></span>
      <span>Level <strong>${p.level}</strong></span>
      <span>Noise <strong>${p.noise}</strong></span>
    </div>
  </div>`;
}

export function renderClipDetailView(ctx: ClipDetailContext): string {
  const { session, draftId, previewBrain } = ctx;
  if (!draftId) {
    return `
      <section class="clip-detail-view clip-detail-empty" id="clip-detail-view">
        <span class="eyebrow">Clip Detail</span>
        <p>Select a clip in the Session grid to inspect its musical content.</p>
      </section>`;
  }
  const draft = session.drafts[draftId];
  if (!draft) {
    return `<section class="clip-detail-view" id="clip-detail-view"><p>Unknown draft ${draftId}</p></section>`;
  }
  const author = resolveDraftAuthor(session, draft);
  let editor = "";
  if (draft.kind === "drums") editor = renderDrumEditor(draft);
  else if (draft.kind === "bass" || draft.kind === "melody") editor = renderPianoEditor(draft);
  else if (draft.kind === "harmony") editor = renderHarmonyEditor(draft);
  else if (draft.kind === "texture") editor = renderTextureEditor(draft);

  const isPreview = isDraftPrivatelyPreviewed(draft, previewBrain as import("../types").BrainId | null);

  return `
    <section class="clip-detail-view ${isPreview ? "clip-previewing" : ""}" id="clip-detail-view" data-draft-id="${draftId}">
      <header class="clip-detail-header">
        <div>
          <span class="eyebrow">Clip Detail · ${draft.kind}</span>
          <h3>${draft.title}</h3>
        </div>
        <span class="pill status-${draft.status}">${draft.status}</span>
      </header>
      <div class="clip-detail-meta">
        <span>Author <strong>${authorDisplayName(session, draft)}</strong></span>
        <span>Role <strong>${author ? formatProductionRole(author.roleId) : "—"}</strong></span>
        <span>Revision <strong>r${draft.revision}</strong></span>
      </div>
      ${editor}
    </section>`;
}
