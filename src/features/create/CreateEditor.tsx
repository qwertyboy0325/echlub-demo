import { Tab, TabList, Tabs } from "react-aria-components";
import { useEffect, useMemo, useState } from "react";
import type { NoteEvent } from "../../types";
import type { CreateSubMode, ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { workspaceForParticipant, createModeLegend } from "../../shell/domain/participantWorkspace";
import { deviceCountForParticipant } from "../../features/devices/DevicesPanel";
import { computePianoRollProjection, pitchToDisplayRow } from "../../ui/pianoRollProjection";
import { useMusicalDraft } from "../../shell/useMusicalDraft";

interface CreateEditorProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

const STEP_WIDTH = 24;
const ROW_HEIGHT = 20;

const DESK_CREATE_DEFAULTS: Record<string, { emphasis: CreateSubMode; trackTargets?: string[]; banner: string }> = {
  Rhythm: { emphasis: "step", trackTargets: ["Drums", "Bass"], banner: "Step-forward · Drums + Bass" },
  Keys: { emphasis: "piano", trackTargets: ["Piano LH", "Piano RH"], banner: "Piano roll · LH / RH lanes" },
  Horns: { emphasis: "clip", trackTargets: ["Alto", "Tenor"], banner: "Phrase lanes · Alto / Tenor" },
  Guitar: { emphasis: "clip", trackTargets: ["Guitar"], banner: "Clip + drive-forward" },
};

export function CreateEditor({ state, dispatch }: CreateEditorProps) {
  const modes: CreateSubMode[] = ["piano", "step", "clip"];
  const labels: Record<CreateSubMode, string> = { piano: "Piano Roll", step: "Step", clip: "Clip" };
  const selected = state.participants.find((p) => p.id === state.selectedParticipantId);
  const workspace = workspaceForParticipant(state, state.selectedParticipantId);
  const draftId = workspace.draftId ?? state.workspaceDraftId;
  const deskDefaults = DESK_CREATE_DEFAULTS[selected?.taskProfile ?? ""] ?? { emphasis: "piano" as const, banner: "Create" };
  const draft = useMusicalDraft(draftId);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [trackTarget, setTrackTarget] = useState(deskDefaults.trackTargets?.[0] ?? "Track");
  const [driveValue, setDriveValue] = useState(42);
  const projection = useMemo(() => computePianoRollProjection(draft), [draft]);
  const selectedNote = draft?.notes?.find((n) => n.id === selectedNoteId);
  const deviceCount = deviceCountForParticipant(state.selectedParticipantId);
  const deskProfile = selected?.taskProfile ?? "generic";
  const modeLegend = createModeLegend(state.createSubMode, deskProfile);
  const modeLabel = labels[state.createSubMode];
  const clipTitle = draft?.title ?? draftId ?? "untitled-draft";

  useEffect(() => {
    setTrackTarget(deskDefaults.trackTargets?.[0] ?? "Track");
  }, [state.selectedParticipantId, deskDefaults.trackTargets]);

  useEffect(() => {
    if (state.selectedPianoNoteId) setSelectedNoteId(state.selectedPianoNoteId);
  }, [state.selectedPianoNoteId]);

  return (
    <div className="create-editor" data-desk-profile={deskProfile} data-create-mode={state.createSubMode}>
      <header className="create-context-header">
        <div className="create-clip-identity">
          <span className="create-scope-badge">Private desk</span>
          <span className="create-clip-label">Clip</span>
          <strong className="create-clip-name tabular-nums">{clipTitle}</strong>
          <span className="create-clip-rev tabular-nums">r{draft?.revision ?? 1}</span>
        </div>
        <p className="create-mode-legend">
          <span className="create-mode-label">{modeLabel}</span>
          <span className="create-mode-legend-text">{modeLegend}</span>
        </p>
      </header>
      <div className="create-toolbar">
        <div className="create-toolbar-primary">
          <span className="create-desk-banner">{deskDefaults.banner}</span>
          <Tabs
            selectedKey={state.createSubMode}
            onSelectionChange={(key) => dispatch({ type: "SET_CREATE_SUBMODE", mode: key as CreateSubMode })}
          >
            <TabList className="create-submodes" aria-label="Editor mode">
              {modes.map((mode) => (
                <Tab
                  key={mode}
                  id={mode}
                  className={`create-submode-tab${mode === deskDefaults.emphasis ? " create-submode-tab--desk-default" : ""}`}
                >
                  {labels[mode]}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </div>
        <div className="create-toolbar-secondary">
        {deskDefaults.trackTargets && deskDefaults.trackTargets.length > 1 && deskProfile === "Keys" && (
          <div className="create-lane-chips" role="group" aria-label="Piano lanes">
            {deskDefaults.trackTargets.map((target) => (
              <button
                key={target}
                type="button"
                className={`create-lane-chip${trackTarget === target ? " create-lane-chip--active" : ""}`}
                onClick={() => setTrackTarget(target)}
              >
                {target}
              </button>
            ))}
          </div>
        )}
        {deskDefaults.trackTargets && deskDefaults.trackTargets.length > 1 && deskProfile !== "Keys" && deskProfile !== "Horns" && (
          <label className="create-track-target">
            Target
            <select value={trackTarget} onChange={(event) => setTrackTarget(event.target.value)}>
              {deskDefaults.trackTargets.map((target) => (
                <option key={target} value={target}>
                  {target}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="devices-summary-btn"
          onClick={() => dispatch({ type: "SET_PARTICIPANT_TAB", tab: "Devices" })}
        >
          <span className="devices-summary-count">
            {deviceCount} Device{deviceCount === 1 ? "" : "s"}
          </span>
          <span className="devices-summary-action">Open Devices</span>
        </button>
        {draftId && (
          <div className="create-audition-group">
            <button
              type="button"
              className={`primary-btn create-audition-btn${state.deskAuditionDraftId === draftId ? " create-audition-btn--active" : ""}`}
              data-demo-target="preview-clip"
              onClick={() => dispatch({ type: "PREVIEW_WORKSPACE", draftId })}
            >
              Desk preview
            </button>
            <span className="create-audition-hint">local only · not Shared Master</span>
          </div>
        )}
        </div>
      </div>
      {state.createSubMode === "piano" && (
        <div className="piano-roll" aria-label="Piano roll editor">
          {(draft?.notes ?? []).length === 0 && (
            <p className="create-empty-hint">No notes yet — double-click a note to nudge steps, or follow the walkthrough to add material.</p>
          )}
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
                  data-demo-target={`piano-note-${note.id}`}
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
              <span className="tabular-nums">
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
        <div className="step-editor-pane">
          {deskProfile === "Rhythm" && (
            <p className="step-forward-hint">Editing {trackTarget} — click steps to toggle hits</p>
          )}
          <div className="step-grid" aria-label="Step sequencer">
            {Array.from({ length: 16 }, (_, i) => {
              const on = draft?.steps?.includes(i) ?? i % 4 === 0;
              return (
                <button
                  key={i}
                  type="button"
                  className={`step-cell${on ? " on" : ""}`}
                  data-demo-target={`step-cell-${i}`}
                  aria-label={`Step ${i + 1}`}
                  onClick={() => draftId && dispatch({ type: "TOGGLE_STEP", draftId, step: i })}
                />
              );
            })}
          </div>
        </div>
      )}
      {state.createSubMode === "clip" && (
        <div className="clip-editor-pane">
          {deskProfile === "Horns" && deskDefaults.trackTargets && (
            <div className="horns-phrase-lanes" role="group" aria-label="Horns phrase lanes">
              {deskDefaults.trackTargets.map((target) => (
                <button
                  key={target}
                  type="button"
                  className={`horns-lane-chip${trackTarget === target ? " horns-lane-chip--active" : ""}`}
                  onClick={() => setTrackTarget(target)}
                >
                  {target}
                </button>
              ))}
            </div>
          )}
          <label>
            Clip name
            <input type="text" defaultValue={draft?.title ?? "untitled-draft"} readOnly className="tabular-nums" />
          </label>
          <p className="clip-meta tabular-nums">
            {trackTarget} · {draftId ?? "—"} · r{draft?.revision ?? 0}
          </p>
          {deskProfile === "Guitar" && (
            <label className="clip-drive-control">
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
              <span className="tabular-nums">{driveValue}</span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
