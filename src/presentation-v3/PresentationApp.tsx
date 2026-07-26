import { useEffect, useMemo, useRef, useState } from "react";
import { ChoreographyOverlay, type ChoreographyOverlayHandle } from "../shell/ChoreographyOverlay";
import { shellAudioAdapter } from "../shell/audio/shellAudioAdapter";
import { StudioTopBar } from "./StudioTopBar";
import { GlobalPerformanceRoom } from "./GlobalPerformanceRoom";
import { ParticipantDeskRoom } from "./ParticipantDeskRoom";
import { MixerPerformanceRoom } from "./MixerPerformanceRoom";
import { ExchangeOverlay } from "./ExchangeOverlay";
import { V3CaptionStrip } from "./choreography/V3CaptionStrip";
import { V3PresenterChrome } from "./choreography/V3PresenterChrome";
import { exposeV3PresenterEvidence, runV3PresentationDemo } from "./choreography/v3ChoreographyRunner";
import {
  formatTransportReadout,
  usePresentationShell,
  usePresentationViewport,
  useTransportHint,
} from "./presentationStateAdapter";
import styles from "./styles/presentation.module.css";

function choreographyEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("choreography") === "1" || params.get("presenter") === "v3";
}

export function PresentationApp() {
  const [state, dispatch] = usePresentationShell();
  const viewport = usePresentationViewport();
  const compact = viewport === "compact";
  const playbackHint = useTransportHint(state);
  const [packError, setPackError] = useState<string | null>(null);
  const [choreoActive, setChoreoActive] = useState(false);
  const engineRef = useRef<ChoreographyOverlayHandle["engine"]>(null);
  const showChoreography = useMemo(() => choreographyEnabled(), []);

  useEffect(() => {
    let cancelled = false;
    void shellAudioAdapter.initialize().catch((error) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : String(error);
      setPackError(message);
      console.error("Shell audio adapter failed:", error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.room === "mixer" && state.exchangeOpen) {
      dispatch({ type: "SET_EXCHANGE_OPEN", open: false });
    }
  }, [state.room, state.exchangeOpen, dispatch]);

  useEffect(() => {
    const fallback = document.getElementById("boot-fallback");
    if (fallback) {
      fallback.hidden = true;
      fallback.setAttribute("aria-hidden", "true");
    }
  }, []);

  useEffect(() => {
    if (!showChoreography) return;
    exposeV3PresenterEvidence();
    const w = window as unknown as {
      __runV3PresentationDemo?: () => Promise<string[]>;
    };
    w.__runV3PresentationDemo = () =>
      runV3PresentationDemo({ engine: engineRef.current, mode: "formal" });
    return () => {
      delete w.__runV3PresentationDemo;
    };
  }, [showChoreography]);

  const roomContent =
    state.room === "global" ? (
      <GlobalPerformanceRoom state={state} dispatch={dispatch} viewport={viewport} />
    ) : state.room === "participant" ? (
      <ParticipantDeskRoom state={state} dispatch={dispatch} viewport={viewport} />
    ) : (
      <MixerPerformanceRoom state={state} dispatch={dispatch} viewport={viewport} />
    );

  return (
    <div
      className={`${styles.root}${compact ? ` ${styles.rootCompact}` : ""}`}
      data-presentation="v3"
    >
      {packError && (
        <div className={styles.bootError} role="alert">
          Pack load warning: {packError}
        </div>
      )}
      {showChoreography && (
        <>
          <V3PresenterChrome engine={engineRef.current} hidden={!choreoActive} />
          <V3CaptionStrip hidden={!choreoActive} />
          <ChoreographyOverlay
            active={choreoActive}
            participants={state.participants}
            onReady={(handle) => {
              engineRef.current = handle.engine;
              setChoreoActive(Boolean(handle.engine));
            }}
          />
        </>
      )}
      <StudioTopBar state={state} dispatch={dispatch} viewport={viewport} />
      <div className={styles.main}>{roomContent}</div>
      <footer className={styles.transport}>
        <button
          type="button"
          className={styles.transportBtn}
          data-demo-target="transport-play"
          onClick={() => dispatch({ type: "TOGGLE_TRANSPORT" })}
        >
          {state.transportPlaying ? "Pause" : "Play"}
        </button>
        <span className={styles.transportReadout}>{formatTransportReadout(state)}</span>
        <span
          className={`${styles.transportHint}${playbackHint.attention ? ` ${styles.transportHintAttention}` : ""}`}
        >
          {state.room === "mixer" ? `Mixer · ${playbackHint.text}` : playbackHint.text}
        </span>
        <button
          type="button"
          className={styles.transportBtn}
          data-demo-target="transport-restart"
          onClick={() => dispatch({ type: "RESTART_SESSION" })}
        >
          Restart
        </button>
      </footer>
      <ExchangeOverlay state={state} dispatch={dispatch} />
    </div>
  );
}
