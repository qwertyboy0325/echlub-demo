import { useCallback, useEffect, useRef, useState } from "react";
import { PresenterNav } from "./features/presenter/PresenterNav";
import { LiveControlDock } from "./features/dock/LiveControlDock";
import { GlobalStudioRoom } from "./rooms/GlobalStudioRoom";
import { MixerPerformanceRoom } from "./rooms/MixerPerformanceRoom";
import { ParticipantWorkspaceRoom } from "./rooms/ParticipantWorkspaceRoom";
import { shellAudioAdapter } from "./shell/audio/shellAudioAdapter";
import { ChoreographyOverlay } from "./shell/ChoreographyOverlay";
import { FocusShell } from "./shell/FocusShell";
import type { ShellChoreographyEngine } from "./shell/choreographyEngine";
import {
  runPhase4Walkthrough,
  runPhase5Walkthrough,
  runPhase5WalkthroughRange,
  PHASE4_WALKTHROUGH,
} from "./shell/presenterWalkthrough";
import { shellStore } from "./shell/domain/shellStore";
import { useShellStore } from "./shell/useShellStore";
import { useViewportMode } from "./shell/useViewportMode";
import { displayTransportBar, resolveTransportPackMode, transportPlaybackHint } from "./shell/transportPlaybackHint";
import { useActiveLaneCount, useMusicalDomainReady, usePackMode, useShellAudioReady } from "./shell/useMusicalDraft";

export function App() {
  const [state, dispatch] = useShellStore();
  const viewport = useViewportMode();
  const compact = viewport === "compact";
  const musicalReady = useMusicalDomainReady();
  const audioReady = useShellAudioReady();
  const activeLaneCount = useActiveLaneCount();
  const packMode = usePackMode();
  const playbackHint = transportPlaybackHint(
    state,
    musicalReady,
    audioReady,
    activeLaneCount,
    packMode === "live-collab" ? "live-collab" : resolveTransportPackMode(),
  );
  const [packError, setPackError] = useState<string | null>(null);
  const [presenterCaption, setPresenterCaption] = useState<string | null>(null);
  const [walkthroughRunning, setWalkthroughRunning] = useState(false);
  const choreographyEngineRef = useRef<ShellChoreographyEngine | null>(null);
  const handleChoreographyReady = useCallback((handle: { engine: ShellChoreographyEngine | null }) => {
    choreographyEngineRef.current = handle.engine;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (typeof window !== "undefined") {
      const globalWindow = window as typeof window & {
        __runPhase4Walkthrough?: () => Promise<string[]>;
        __runPhase4WalkthroughUntil?: (maxBeat: number) => Promise<string[]>;
        __runPhase4WalkthroughRange?: (fromBeat: number, toBeat: number) => Promise<string[]>;
        __runPhase5Walkthrough?: () => Promise<string[]>;
        __runPhase5WalkthroughUntil?: (maxBeat: number) => Promise<string[]>;
        __runPhase5WalkthroughRange?: (fromBeat: number, toBeat: number) => Promise<string[]>;
        __shellStore?: typeof shellStore;
      };
      globalWindow.__runPhase4WalkthroughRange = async (fromBeat: number, toBeat: number) => {
        const labels: string[] = [];
        for (const step of PHASE4_WALKTHROUGH.filter((entry) => entry.beat >= fromBeat && entry.beat <= toBeat)) {
          labels.push(step.label);
          for (const command of step.commands) shellStore.dispatch(command);
        }
        return labels;
      };
      globalWindow.__runPhase4WalkthroughUntil = async (maxBeat: number) => {
        const labels: string[] = [];
        for (const step of PHASE4_WALKTHROUGH.filter((entry) => entry.beat <= maxBeat)) {
          labels.push(step.label);
          for (const command of step.commands) shellStore.dispatch(command);
        }
        return labels;
      };
      globalWindow.__runPhase4Walkthrough = async () => {
        const labels: string[] = [];
        await runPhase4Walkthrough(undefined, (step) => labels.push(step.label));
        return labels;
      };
      globalWindow.__runPhase5Walkthrough = async () => {
        setWalkthroughRunning(true);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        try {
          return await runPhase5Walkthrough(
            shellStore.dispatch.bind(shellStore),
            (step) => {
              setPresenterCaption(step.label);
            },
            {
              choreographyEngine: choreographyEngineRef.current,
              onMissingTarget: (selector, step) => {
                console.warn(`[choreography] missing target ${selector} at beat "${step.label}"`);
              },
            },
          );
        } finally {
          setWalkthroughRunning(false);
        }
      };
      globalWindow.__runPhase5WalkthroughUntil = async (maxBeat: number) => {
        setWalkthroughRunning(true);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        try {
          return await runPhase5Walkthrough(
            shellStore.dispatch.bind(shellStore),
            (step) => {
              setPresenterCaption(step.label);
            },
            {
              choreographyEngine: choreographyEngineRef.current,
              onMissingTarget: (selector, step) => {
                console.warn(`[choreography] missing target ${selector} at beat "${step.label}"`);
              },
              maxBeat,
            },
          );
        } finally {
          setWalkthroughRunning(false);
        }
      };
      globalWindow.__runPhase5WalkthroughRange = async (fromBeat: number, toBeat: number) => {
        setWalkthroughRunning(true);
        try {
          return await runPhase5WalkthroughRange(fromBeat, toBeat, shellStore.dispatch.bind(shellStore));
        } finally {
          setWalkthroughRunning(false);
        }
      };
      globalWindow.__shellStore = shellStore;
    }
    void shellAudioAdapter.initialize().catch((error) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : String(error);
      setPackError(message);
      console.error("Shell audio adapter failed:", error);
    });
    return () => {
      cancelled = true;
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
        <button type="button" data-demo-target="transport-play" onClick={() => dispatch({ type: "TOGGLE_TRANSPORT" })}>
          {state.transportPlaying ? "Pause" : "Play"}
        </button>
        <span className="tabular-nums">
          Shared transport · bar {displayTransportBar(state.transportBar)}:{state.transportBeat + 1}
        </span>
        <span className={`transport-hint${playbackHint.attention ? " transport-hint--attention" : ""}`}>
          {playbackHint.text}
        </span>
        <button type="button" data-demo-target="transport-restart" onClick={() => dispatch({ type: "RESTART_SESSION" })}>
          Restart
        </button>
      </div>
    );

  const runPhase5Demo = () => {
    void (window as Window & { __runPhase5Walkthrough?: () => Promise<string[]> }).__runPhase5Walkthrough?.();
  };

  return (
    <div className={`app-root${packError ? " app-root--boot-error" : ""}`}>
      {packError && (
        <div className="boot-error-banner" role="alert">
          Public pack failed to load ({packError}). UI stays available, but Play / Preview clip need{" "}
          <code>shiki-no-uta.demo.pack.json</code>. Dev server: open{" "}
          <code>http://localhost:4173/</code> (not <code>/echlub-demo/</code>). Preview/build:{" "}
          <code>/echlub-demo/</code>
        </div>
      )}
      <PresenterNav
        state={state}
        dispatch={dispatch}
        onRunPhase5Demo={packMode === "live-collab" ? runPhase5Demo : undefined}
        walkthroughRunning={walkthroughRunning}
      />
      <FocusShell
        state={state}
        dispatch={dispatch}
        viewport={viewport}
        center={center}
        bottom={bottom}
        bottomVariant={state.room === "mixer" ? "dock" : "transport"}
        presenterCaption={presenterCaption}
      />
      <ChoreographyOverlay
        active={walkthroughRunning}
        participants={state.participants}
        onReady={handleChoreographyReady}
      />
    </div>
  );
}
