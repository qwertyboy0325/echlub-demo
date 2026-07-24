import type { ShellCommand, ShellState } from "../../shell/domain/shellTypes";

interface PresenceRailProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  compact: boolean;
}

export function PresenceRail({ state, dispatch, compact }: PresenceRailProps) {
  return (
    <aside className={`presence-rail${compact ? " presence-rail--compact" : ""}`} aria-label="Participant presence">
      {!compact && <h2 className="section-label">Presence</h2>}
      {state.participants.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`presence-person${p.active ? " active" : ""}`}
          onClick={() => {
            dispatch({ type: "SELECT_PARTICIPANT", participantId: p.id });
            if (state.room === "global") dispatch({ type: "SET_ROOM", room: "participant" });
          }}
          title={`${p.name} · ${p.taskProfile}`}
        >
          <span
            className="avatar"
            style={{ boxShadow: `inset 0 0 0 1px var(--separator), 0 0 0 2px ${p.color}` }}
            aria-hidden="true"
          />
          {!compact && (
            <span className="presence-text">
              <strong>{p.name}</strong>
              <span>{p.taskProfile}</span>
            </span>
          )}
        </button>
      ))}
    </aside>
  );
}
