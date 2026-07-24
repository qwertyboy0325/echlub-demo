import { PresenterNav } from "./features/presenter/PresenterNav";
import { LiveControlDock } from "./features/dock/LiveControlDock";
import { GlobalStudioRoom } from "./rooms/GlobalStudioRoom";
import { MixerPerformanceRoom } from "./rooms/MixerPerformanceRoom";
import { ParticipantWorkspaceRoom } from "./rooms/ParticipantWorkspaceRoom";
import { FocusShell } from "./shell/FocusShell";
import { useShellStore } from "./shell/useShellStore";
import { useViewportMode } from "./shell/useViewportMode";

export function App() {
  const [state, dispatch] = useShellStore();
  const viewport = useViewportMode();
  const compact = viewport === "compact";

  const center =
    state.room === "global" ? (
      <GlobalStudioRoom state={state} dispatch={dispatch} />
    ) : state.room === "participant" ? (
      <ParticipantWorkspaceRoom state={state} dispatch={dispatch} />
    ) : (
      <MixerPerformanceRoom state={state} dispatch={dispatch} />
    );

  const bottom =
    state.room === "mixer" ? (
      <LiveControlDock state={state} dispatch={dispatch} compact={compact} />
    ) : (
      <div className="transport-bar">
        <button type="button" onClick={() => dispatch({ type: "TOGGLE_TRANSPORT" })}>
          {state.transportPlaying ? "Pause" : "Play"}
        </button>
        <span>Shared transport · fixture only</span>
      </div>
    );

  return (
    <div className="app-root">
      <PresenterNav state={state} dispatch={dispatch} />
      <FocusShell
        state={state}
        dispatch={dispatch}
        viewport={viewport}
        center={center}
        bottom={bottom}
        bottomVariant={state.room === "mixer" ? "dock" : "transport"}
      />
    </div>
  );
}
