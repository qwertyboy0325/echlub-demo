import { Pause, Play } from "lucide-react";
import type { RoomId, ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { followBannerText, participantDeskShortLabel, possessiveDeskShortLabel } from "../../shell/participantProjection";
import { PHASE5_WALKTHROUGH } from "../../shell/presenterWalkthrough";

interface PresenterNavProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  presenterMode?: boolean;
  onRunPhase5Demo?: () => void;
  onPauseWalkthrough?: () => void;
  onStopWalkthrough?: () => void;
  onRestartWalkthrough?: () => void;
  walkthroughRunning?: boolean;
  walkthroughPaused?: boolean;
  walkthroughBeat?: number;
}

function participantNavLabel(state: ShellState, presenterMode: boolean, walkthroughRunning: boolean): string {
  if (presenterMode && walkthroughRunning) return "Participant";
  const desk = possessiveDeskShortLabel(state) ?? participantDeskShortLabel(state);
  return desk ?? "Participant";
}

export function PresenterNav({
  state,
  dispatch,
  presenterMode = false,
  onRunPhase5Demo,
  onPauseWalkthrough,
  onStopWalkthrough,
  onRestartWalkthrough,
  walkthroughRunning = false,
  walkthroughPaused = false,
  walkthroughBeat = 0,
}: PresenterNavProps) {
  const setRoom = (room: RoomId) => dispatch({ type: "SET_ROOM", room });
  const banner = followBannerText(state);
  const participantLabel = participantNavLabel(state, presenterMode, walkthroughRunning);
  const totalBeats = PHASE5_WALKTHROUGH.length;
  const currentStep = PHASE5_WALKTHROUGH.find((step) => step.beat === walkthroughBeat);

  return (
    <header className="presenter-nav">
      <div className="brand">EchLub{presenterMode ? " · Presenter" : ""}</div>
      <nav className="room-nav" aria-label="Presenter rooms">
        <button type="button" className={state.room === "global" ? "active" : ""} onClick={() => setRoom("global")}>
          Global Studio
        </button>
        <button
          type="button"
          className={state.room === "participant" ? "active" : ""}
          onClick={() => setRoom("participant")}
        >
          {participantLabel}
        </button>
        <button type="button" className={state.room === "mixer" ? "active" : ""} onClick={() => setRoom("mixer")}>
          Mixer
        </button>
      </nav>
      <div className="follow-controls">
        {banner && <span className="follow-chip follow-chip--active follow-chip--banner">{banner}</span>}
        {!banner && state.followActive && !state.followLocked && (
          <span className="follow-chip follow-chip--active">Follow active</span>
        )}
        {state.followLocked && <span className="follow-chip follow-chip--locked">Follow locked</span>}
        <button
          type="button"
          disabled={state.interactionFrozen || (presenterMode && walkthroughRunning)}
          onClick={() => dispatch({ type: state.followLocked ? "RESUME_FOLLOW" : "ENABLE_FOLLOW" })}
        >
          {state.followLocked ? "Resume Follow" : "Follow Active"}
        </button>
        {presenterMode && onRunPhase5Demo && (
          <>
            <button
              type="button"
              className="presenter-run-demo-btn"
              disabled={walkthroughRunning && !walkthroughPaused}
              onClick={onRunPhase5Demo}
            >
              {walkthroughRunning && !walkthroughPaused ? "Running…" : "Run demo"}
            </button>
            {walkthroughRunning && (
              <button type="button" className="presenter-pause-btn" onClick={onPauseWalkthrough}>
                {walkthroughPaused ? "Resume" : "Pause"}
              </button>
            )}
            {walkthroughRunning && (
              <button type="button" className="presenter-stop-btn" onClick={onStopWalkthrough}>
                Stop
              </button>
            )}
            <button type="button" className="presenter-restart-btn" onClick={onRestartWalkthrough}>
              Restart
            </button>
            {walkthroughRunning && walkthroughBeat > 0 && (
              <span className="presenter-progress tabular-nums">
                Beat {walkthroughBeat}/{totalBeats}
                {currentStep ? ` · ${currentStep.label}` : ""}
              </span>
            )}
          </>
        )}
        {!presenterMode && import.meta.env.DEV && onRunPhase5Demo && (
          <button
            type="button"
            className="presenter-run-demo-btn"
            disabled={walkthroughRunning}
            onClick={onRunPhase5Demo}
          >
            {walkthroughRunning ? "Running…" : "Run demo"}
          </button>
        )}
      </div>
      <div className="transport-readout tabular-nums">
        {state.transportPlaying ? <Play size={12} aria-hidden /> : <Pause size={12} aria-hidden />}
        <span>
          bar {state.transportBar + 1} · beat {state.transportBeat + 1}
        </span>
      </div>
    </header>
  );
}
