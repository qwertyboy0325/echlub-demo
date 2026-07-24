import { useEffect, useRef } from "react";
import { PresenterNav } from "./features/presenter/PresenterNav";
import { LiveControlDock } from "./features/dock/LiveControlDock";
import { GlobalStudioRoom } from "./rooms/GlobalStudioRoom";
import { MixerPerformanceRoom } from "./rooms/MixerPerformanceRoom";
import { ParticipantWorkspaceRoom } from "./rooms/ParticipantWorkspaceRoom";
import { installShellAudioDispatchBridge, shellAudioAdapter } from "./shell/audio/shellAudioAdapter";
import { FocusShell } from "./shell/FocusShell";
import { useShellStore } from "./shell/useShellStore";
import { useViewportMode } from "./shell/useViewportMode";
import { useMusicalDomainReady } from "./shell/useMusicalDraft";

export function App() {
  const [state, dispatch] = useShellStore();
  const viewport = useViewportMode();
  const compact = viewport === "compact";
  const musicalReady = useMusicalDomainReady();
  const bridgeInstalled = useRef(false);

  useEffect(() => {
    if (!bridgeInstalled.current) {
      installShellAudioDispatchBridge();
      bridgeInstalled.current = true;
    }
    void shellAudioAdapter.initialize().catch((error) => {
      console.error("Shell audio adapter failed:", error);
    });
    return () => shellAudioAdapter.dispose();
  }, []);

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
        <span className="tabular-nums">
          Shared transport · bar {state.transportBar}:{state.transportBeat}
          {state.activeMasterDraftId ? ` · master: ${state.activeMasterDraftId}` : ""}
          {!musicalReady ? " · loading pack…" : ""}
        </span>
        <button type="button" onClick={() => dispatch({ type: "RESTART_SESSION" })}>
          Restart
        </button>
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
