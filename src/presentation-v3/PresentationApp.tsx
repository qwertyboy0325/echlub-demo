import { useEffect, useState } from "react";
import { shellAudioAdapter } from "../shell/audio/shellAudioAdapter";
import { StudioTopBar } from "./StudioTopBar";
import { GlobalPerformanceRoom } from "./GlobalPerformanceRoom";
import { ParticipantDeskRoom } from "./ParticipantDeskRoom";
import { MixerPerformanceRoom } from "./MixerPerformanceRoom";
import { ExchangeOverlay } from "./ExchangeOverlay";
import {
  formatTransportReadout,
  usePresentationShell,
  usePresentationViewport,
  useTransportHint,
} from "./presentationStateAdapter";
import styles from "./styles/presentation.module.css";

export function PresentationApp() {
  const [state, dispatch] = usePresentationShell();
  const viewport = usePresentationViewport();
  const compact = viewport === "compact";
  const playbackHint = useTransportHint(state);
  const [packError, setPackError] = useState<string | null>(null);

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

  const roomContent =
    state.room === "global" ? (
      <GlobalPerformanceRoom state={state} dispatch={dispatch} viewport={viewport} />
    ) : state.room === "participant" ? (
      <ParticipantDeskRoom state={state} dispatch={dispatch} viewport={viewport} />
    ) : (
      <MixerPerformanceRoom state={state} dispatch={dispatch} viewport={viewport} />
    );

  return (
    <div className={`${styles.root}${compact ? ` ${styles.rootCompact}` : ""}`}>
      {packError && (
        <div className={styles.bootError} role="alert">
          Pack load warning: {packError}
        </div>
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
