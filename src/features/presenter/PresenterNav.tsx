import { Pause, Play } from "lucide-react";
import type { RoomId, ShellCommand, ShellState } from "../../shell/domain/shellTypes";

interface PresenterNavProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

export function PresenterNav({ state, dispatch }: PresenterNavProps) {
  const setRoom = (room: RoomId) => dispatch({ type: "SET_ROOM", room });

  return (
    <header className="presenter-nav">
      <div className="brand">EchLub</div>
      <nav className="room-nav" aria-label="Presenter rooms">
        <button type="button" className={state.room === "global" ? "active" : ""} onClick={() => setRoom("global")}>
          Global Studio
        </button>
        <button
          type="button"
          className={state.room === "participant" ? "active" : ""}
          onClick={() => setRoom("participant")}
        >
          Participant
        </button>
        <button type="button" className={state.room === "mixer" ? "active" : ""} onClick={() => setRoom("mixer")}>
          Mixer
        </button>
      </nav>
      <div className="follow-controls">
        {state.followActive && !state.followLocked && (
          <span className="follow-chip follow-chip--active">
            Following {state.participants.find((p) => p.active)?.name}
          </span>
        )}
        {state.followLocked && <span className="follow-chip follow-chip--locked">Follow locked</span>}
        <button
          type="button"
          disabled={state.interactionFrozen}
          onClick={() => dispatch({ type: state.followLocked ? "RESUME_FOLLOW" : "ENABLE_FOLLOW" })}
        >
          {state.followLocked ? "Resume Follow" : "Follow Active"}
        </button>
      </div>
      <div className="transport-readout tabular-nums">
        {state.transportPlaying ? <Play size={12} aria-hidden /> : <Pause size={12} aria-hidden />}
        <span>
          bar {state.transportBar}.{state.transportBeat}.1
        </span>
      </div>
    </header>
  );
}
