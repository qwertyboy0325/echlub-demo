import type { ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { deskLabelForProfile, participantInitial } from "../../shell/domain/participantWorkspace";
import { participantDeskShortLabel } from "../../shell/participantProjection";

interface PresenceRailProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  compact: boolean;
}

export function PresenceRail({ state, dispatch, compact }: PresenceRailProps) {
  const activeDesk = participantDeskShortLabel(state);

  return (
    <aside className={`presence-rail${compact ? " presence-rail--compact" : ""}`} aria-label="Participant presence">
      {!compact && <h2 className="section-label">Presence</h2>}
      {compact && activeDesk && state.room === "participant" && (
        <span className="presence-active-desk-chip">{activeDesk}</span>
      )}
      {state.participants.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`presence-person${p.active ? " active" : ""}`}
          data-demo-target={`participant-${p.id}`}
          onClick={() => {
            dispatch({ type: "SELECT_PARTICIPANT", participantId: p.id });
            if (state.room === "global") dispatch({ type: "SET_ROOM", room: "participant" });
          }}
          title={`${p.name} · ${deskLabelForProfile(p.taskProfile)}`}
        >
          <span
            className="avatar"
            style={{ boxShadow: `inset 0 0 0 1px var(--separator), 0 0 0 2px ${p.color}` }}
            aria-hidden="true"
          >
            <span className="avatar-initial">{participantInitial(p.name)}</span>
          </span>
          {!compact && (
            <span className="presence-text">
              <strong>{p.name}</strong>
              <span>{deskLabelForProfile(p.taskProfile)}</span>
            </span>
          )}
          {compact && <span className="presence-compact-name">{p.name}</span>}
        </button>
      ))}
    </aside>
  );
}
