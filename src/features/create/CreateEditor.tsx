import type { CreateSubMode, ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { DevicesPanel } from "../devices/DevicesPanel";

interface CreateEditorProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

export function CreateEditor({ state, dispatch }: CreateEditorProps) {
  const modes: CreateSubMode[] = ["piano", "step", "clip"];

  return (
    <div className="create-editor">
      <div className="create-toolbar">
        <div className="create-submodes" role="tablist" aria-label="Create sub-mode">
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={state.createSubMode === mode}
              className={state.createSubMode === mode ? "active" : ""}
              onClick={() => dispatch({ type: "SET_CREATE_SUBMODE", mode })}
            >
              {mode === "piano" ? "Piano Roll" : mode === "step" ? "Step" : "Clip"}
            </button>
          ))}
        </div>
        <div className="create-floating-devices">
          <DevicesPanel dispatch={dispatch} draggable />
        </div>
      </div>
      {state.createSubMode === "piano" && (
        <div className="piano-roll" aria-label="Piano roll editor">
          <div className="piano-grid">
            <div className="piano-note" style={{ left: 120, top: 80, width: 72 }} />
            <div className="piano-note" style={{ left: 200, top: 120, width: 48 }} />
          </div>
        </div>
      )}
      {state.createSubMode === "step" && (
        <div className="step-grid" aria-label="Step sequencer">
          {Array.from({ length: 16 }, (_, i) => (
            <button key={i} type="button" className={`step-cell${i % 4 === 0 ? " on" : ""}`} aria-label={`Step ${i + 1}`} />
          ))}
        </div>
      )}
      {state.createSubMode === "clip" && (
        <div className="clip-editor-pane">
          <label>
            Clip name
            <input type="text" defaultValue="pulse-draft" readOnly />
          </label>
        </div>
      )}
    </div>
  );
}
