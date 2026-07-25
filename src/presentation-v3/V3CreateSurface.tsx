import { useEffect, useMemo, useState } from "react";
import type { NoteEvent } from "../types";
import type { CreateSubMode, ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { workspaceForParticipant } from "../shell/domain/participantWorkspace";
import { computePianoRollProjection, pitchToDisplayRow } from "../ui/pianoRollProjection";
import { useMusicalDraft } from "../shell/useMusicalDraft";
import styles from "./styles/v3CreateSurface.module.css";

const STEP_WIDTH = 24;
const ROW_HEIGHT = 20;

const DESK_DEFAULTS: Record<
  string,
  { emphasis: CreateSubMode; trackTargets?: string[] }
> = {
  Rhythm: { emphasis: "step", trackTargets: ["Drums", "Bass"] },
  Keys: { emphasis: "piano", trackTargets: ["Piano LH", "Piano RH"] },
  Horns: { emphasis: "clip", trackTargets: ["Alto", "Tenor"] },
  Guitar: { emphasis: "clip", trackTargets: ["Guitar"] },
};

const MODE_LABELS: Record<CreateSubMode, string> = {
  piano: "Piano Roll",
  step: "Step",
  clip: "Clip",
};

interface V3CreateSurfaceProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

export function V3CreateSurface({ state, dispatch }: V3CreateSurfaceProps) {
  const selected = state.participants.find((p) => p.id === state.selectedParticipantId);
  const workspace = workspaceForParticipant(state, state.selectedParticipantId);
  const draftId = workspace.draftId ?? state.workspaceDraftId;
  const deskProfile = selected?.taskProfile ?? "generic";
  const deskDefaults = DESK_DEFAULTS[deskProfile] ?? { emphasis: "piano" as const };
  const draft = useMusicalDraft(draftId);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [trackTarget, setTrackTarget] = useState(deskDefaults.trackTargets?.[0] ?? "Track");
  const [driveValue, setDriveValue] = useState(42);
  const projection = useMemo(() => computePianoRollProjection(draft), [draft]);
  const selectedNote = draft?.notes?.find((n) => n.id === selectedNoteId);
  const clipTitle = draft?.title ?? draftId ?? "untitled";
  const previewing = draftId && state.deskAuditionDraftId === draftId;

  useEffect(() => {
    setTrackTarget(deskDefaults.trackTargets?.[0] ?? "Track");
  }, [state.selectedParticipantId, deskDefaults.trackTargets]);

  useEffect(() => {
    if (state.selectedPianoNoteId) setSelectedNoteId(state.selectedPianoNoteId);
  }, [state.selectedPianoNoteId]);

  const setMode = (mode: CreateSubMode) => dispatch({ type: "SET_CREATE_SUBMODE", mode });

  return (
    <div className={styles.surface} data-surface="v3-create">
      <header className={styles.header}>
        <span className={styles.clipTitle}>{clipTitle}</span>
        <span className={styles.revision}>r{draft?.revision ?? 1}</span>
        <div className={styles.modeTabs} role="tablist" aria-label="Editor mode">
          {(["piano", "step", "clip"] as CreateSubMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={state.createSubMode === mode}
              className={state.createSubMode === mode ? styles.modeTabActive : styles.modeTab}
              onClick={() => setMode(mode)}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        {deskDefaults.trackTargets && deskDefaults.trackTargets.length > 1 && (
          <div className={styles.laneChips} role="group" aria-label="Track target">
            {deskDefaults.trackTargets.map((target) => (
              <button
                key={target}
                type="button"
                className={trackTarget === target ? styles.laneChipActive : styles.laneChip}
                onClick={() => setTrackTarget(target)}
              >
                {target}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className={styles.editorPane}>
        {state.createSubMode === "piano" && (
          <>
            <div className={styles.pianoGrid} aria-label="Piano roll">
              {(draft?.notes ?? []).length === 0 && (
                <p className={styles.emptyHint}>Click notes to select · double-click to nudge steps</p>
              )}
              {(draft?.notes ?? []).map((note: NoteEvent) => {
                const row = pitchToDisplayRow(note.pitch, projection);
                const left = (note.bar ?? 0) * 16 * STEP_WIDTH + note.step * STEP_WIDTH;
                return (
                  <button
                    key={note.id}
                    type="button"
                    className={selectedNoteId === note.id ? styles.pianoNoteSelected : styles.pianoNote}
                    data-demo-target={`piano-note-${note.id}`}
                    style={{
                      left,
                      top: row * ROW_HEIGHT + 2,
                      width: STEP_WIDTH * 2,
                      height: ROW_HEIGHT - 4,
                    }}
                    aria-label={`${note.note} step ${note.step}`}
                    onClick={() => {
                      setSelectedNoteId(note.id);
                      if (draftId) dispatch({ type: "SELECT_PIANO_NOTE", draftId, noteId: note.id });
                    }}
                    onDoubleClick={() => {
                      if (!draftId) return;
                      dispatch({
                        type: "EDIT_NOTE_STEP",
                        draftId,
                        noteId: note.id,
                        step: Math.min(15, note.step + 1),
                      });
                    }}
                  />
                );
              })}
            </div>
            {selectedNote && draftId && (
              <div className={styles.inspector}>
                <span>
                  {trackTarget} · {selectedNote.note} · step {selectedNote.step}
                </span>
                <label>
                  Velocity
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={Math.round(selectedNote.velocity * 100)}
                    data-demo-target={`velocity-${selectedNote.id}`}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_NOTE_VELOCITY",
                        draftId,
                        noteId: selectedNote.id,
                        velocity: Number(e.target.value) / 100,
                      })
                    }
                  />
                </label>
              </div>
            )}
          </>
        )}

        {state.createSubMode === "step" && (
          <div className={styles.stepGrid} aria-label="Step sequencer">
            {Array.from({ length: 16 }, (_, i) => {
              const on = draft?.steps?.includes(i) ?? i % 4 === 0;
              return (
                <button
                  key={i}
                  type="button"
                  className={on ? styles.stepCellOn : styles.stepCell}
                  data-demo-target={`step-cell-${i}`}
                  aria-label={`Step ${i + 1}`}
                  aria-pressed={on}
                  onClick={() => draftId && dispatch({ type: "TOGGLE_STEP", draftId, step: i })}
                />
              );
            })}
          </div>
        )}

        {state.createSubMode === "clip" && (
          <div className={styles.clipPane}>
            <p className={styles.emptyHint}>
              {trackTarget} · {draftId ?? "—"}
            </p>
            {deskProfile === "Guitar" && (
              <label className={styles.driveLabel}>
                Drive
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={driveValue}
                  data-demo-target="device-knob-filter"
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setDriveValue(value);
                    dispatch({ type: "SET_DEVICE_PARAM", deviceId: "filter", value: value / 100 });
                  }}
                />
                <span>{driveValue}</span>
              </label>
            )}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={previewing ? styles.previewActive : styles.btnPrimary}
          data-demo-target="preview-clip"
          disabled={!draftId}
          onClick={() => draftId && dispatch({ type: "PREVIEW_WORKSPACE", draftId })}
        >
          Preview
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          data-demo-target="save-to-library"
          disabled={!draftId}
          onClick={() => dispatch({ type: "SAVE_TO_LIBRARY" })}
        >
          Save to Library
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          data-demo-target="share-clip"
          disabled={!draftId}
          onClick={() => dispatch({ type: "SHARE_CLIP" })}
        >
          Share to Exchange
        </button>
      </div>
    </div>
  );
}
