import { useEffect, useState } from "react";
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
  const [packError, setPackError] = useState<string | null>(null);

  useEffect(() => {
    const uninstallBridge = installShellAudioDispatchBridge();
    let cancelled = false;
    void shellAudioAdapter.initialize().catch((error) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : String(error);
      setPackError(message);
      console.error("Shell audio adapter failed:", error);
    });
    return () => {
      cancelled = true;
      uninstallBridge();
      shellAudioAdapter.dispose();
      setPackError(null);
    };
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
    <div className={`app-root${packError ? " app-root--boot-error" : ""}`}>
      {packError && (
        <div className="boot-error-banner" role="alert">
          Public pack failed to load ({packError}). UI stays available, but Play / Preview clip need{" "}
          <code>shiki-no-uta.demo.pack.json</code> at the app origin. Dev:{" "}
          <code>http://localhost:4173/</code> · Preview/build: <code>/echlub-demo/</code>
        </div>
      )}
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
