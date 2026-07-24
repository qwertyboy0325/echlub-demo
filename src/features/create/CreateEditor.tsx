import { Tab, TabList, Tabs } from "react-aria-components";
import { useMemo, useState } from "react";
import type { NoteEvent } from "../../types";
import type { CreateSubMode, ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { computePianoRollProjection, pitchToDisplayRow } from "../../ui/pianoRollProjection";
import { useMusicalDraft } from "../../shell/useMusicalDraft";

interface CreateEditorProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

const STEP_WIDTH = 24;
const ROW_HEIGHT = 20;

export function CreateEditor({ state, dispatch }: CreateEditorProps) {
  const modes: CreateSubMode[] = ["piano", "step", "clip"];
  const labels: Record<CreateSubMode, string> = { piano: "Piano Roll", step: "Step", clip: "Clip" };
  const draftId = state.workspaceDraftId;
  const draft = useMusicalDraft(draftId);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const projection = useMemo(() => computePianoRollProjection(draft), [draft]);
  const selectedNote = draft?.notes?.find((n) => n.id === selectedNoteId);

  return (
    <div className="create-editor">
      <div className="create-toolbar">
        <Tabs
          selectedKey={state.createSubMode}
          onSelectionChange={(key) => dispatch({ type: "SET_CREATE_SUBMODE", mode: key as CreateSubMode })}
        >
          <TabList className="create-submodes" aria-label="Create sub-mode">
            {modes.map((mode) => (
              <Tab key={mode} id={mode} className="create-submode-tab">
                {labels[mode]}
              </Tab>
            ))}
          </TabList>
        </Tabs>
        <button
          type="button"
          className="devices-summary-btn"
          onClick={() => dispatch({ type: "SET_PARTICIPANT_TAB", tab: "Devices" })}
        >
          <span className="devices-summary-count">3 Devices</span>
          <span className="devices-summary-action">Open Devices</span>
        </button>
        {draftId && (
          <button
            type="button"
            className="primary-btn"
            onClick={() => dispatch({ type: "PREVIEW_WORKSPACE", draftId })}
          >
            Preview clip
          </button>
        )}
      </div>
      {state.createSubMode === "piano" && (
        <div className="piano-roll" aria-label="Piano roll editor">
          <div className="piano-grid">
            {(draft?.notes ?? []).map((note: NoteEvent) => {
              const row = pitchToDisplayRow(note.pitch, projection);
              const left = (note.bar ?? 0) * 16 * STEP_WIDTH + note.step * STEP_WIDTH;
              const width = STEP_WIDTH * 2;
              return (
                <button
                  key={note.id}
                  type="button"
                  className={`piano-note${selectedNoteId === note.id ? " piano-note--accent" : ""}`}
                  style={{ left, top: row * ROW_HEIGHT + 2, width, height: ROW_HEIGHT - 4 }}
                  aria-label={`${note.note} step ${note.step}`}
                  onClick={() => setSelectedNoteId(note.id)}
                  onDoubleClick={() => {
                    if (!draftId) return;
                    dispatch({ type: "EDIT_NOTE_STEP", draftId, noteId: note.id, step: Math.min(15, note.step + 1) });
                  }}
                />
              );
            })}
            <div className="playhead" />
          </div>
          {selectedNote && draftId && (
            <div className="piano-inspector">
              <span className="tabular-nums">{selectedNote.note} · step {selectedNote.step}</span>
              <label>
                Velocity
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(selectedNote.velocity * 100)}
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
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: "EDIT_NOTE_STEP",
                    draftId,
                    noteId: selectedNote.id,
                    step: Math.max(0, selectedNote.step - 1),
                  })
                }
              >
                ← step
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: "EDIT_NOTE_STEP",
                    draftId,
                    noteId: selectedNote.id,
                    step: Math.min(15, selectedNote.step + 1),
                  })
                }
              >
                step →
              </button>
            </div>
          )}
        </div>
      )}
      {state.createSubMode === "step" && (
        <div className="step-grid" aria-label="Step sequencer">
          {Array.from({ length: 16 }, (_, i) => {
            const on = draft?.steps?.includes(i) ?? i % 4 === 0;
            return (
              <button
                key={i}
                type="button"
                className={`step-cell${on ? " on" : ""}`}
                aria-label={`Step ${i + 1}`}
                onClick={() => draftId && dispatch({ type: "TOGGLE_STEP", draftId, step: i })}
              />
            );
          })}
        </div>
      )}
      {state.createSubMode === "clip" && (
        <div className="clip-editor-pane">
          <label>
            Clip name
            <input type="text" defaultValue={draft?.title ?? "untitled-draft"} readOnly className="tabular-nums" />
          </label>
          <p className="clip-meta tabular-nums">
            {draftId ?? "—"} · r{draft?.revision ?? 0}
          </p>
        </div>
      )}
    </div>
  );
}
