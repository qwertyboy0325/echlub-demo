import { Tab, TabList, Tabs } from "react-aria-components";
import type { CreateSubMode, ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { DevicesPanel } from "../devices/DevicesPanel";

interface CreateEditorProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

export function CreateEditor({ state, dispatch }: CreateEditorProps) {
  const modes: CreateSubMode[] = ["piano", "step", "clip"];
  const labels: Record<CreateSubMode, string> = { piano: "Piano Roll", step: "Step", clip: "Clip" };

  return (
    <div className="create-editor">
      <div className="create-toolbar">
        <Tabs
          selectedKey={state.createSubMode}
          onSelectionChange={(key) => dispatch({ type: "SET_CREATE_SUBMODE", mode: key as CreateSubMode })}
        >
          <TabList className="create-submodes" aria-label="Create sub-mode">
            {modes.map((mode) => (
              <Tab key={mode} id={mode}>
                {labels[mode]}
              </Tab>
            ))}
          </TabList>
        </Tabs>
        <div className="create-floating-devices">
          <DevicesPanel dispatch={dispatch} draggable />
        </div>
      </div>
      {state.createSubMode === "piano" && (
        <div className="piano-roll" aria-label="Piano roll editor">
          <div className="piano-grid">
            <div className="piano-note" style={{ left: 120, top: 80, width: 72 }} />
            <div className="piano-note" style={{ left: 200, top: 120, width: 48 }} />
            <div className="playhead" />
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
            <input type="text" defaultValue="pulse-draft" readOnly className="tabular-nums" />
          </label>
        </div>
      )}
    </div>
  );
}
