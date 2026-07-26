import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { participantInitial } from "../shell/domain/participantWorkspace";
import { setPresentationRoom, selectParticipant, toggleExchange } from "./presentationStateAdapter";
import type { PresentationViewport } from "./presentationStateAdapter";
import styles from "./styles/studioTopBar.module.css";

interface StudioTopBarProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  viewport: PresentationViewport;
}

function participantDeskLabel(state: ShellState): string {
  const p = state.participants.find((entry) => entry.id === state.selectedParticipantId);
  return p ? `${p.name} Desk` : "Participant";
}

export function StudioTopBar({ state, dispatch, viewport }: StudioTopBarProps) {
  const compact = viewport === "compact";
  const showExchange = state.room !== "mixer";

  return (
    <header className={`${styles.bar}${compact ? ` ${styles.compact}` : ""}`}>
      <span className={styles.brand}>EchLub Studio</span>
      <nav className={styles.nav} aria-label="Rooms">
        <button
          type="button"
          className={state.room === "global" ? styles.navBtnActive : styles.navBtn}
          data-demo-target="room-global"
          onClick={() => setPresentationRoom(dispatch, "global")}
        >
          Global
        </button>
        <button
          type="button"
          className={state.room === "participant" ? styles.navBtnActive : styles.navBtn}
          data-demo-target="room-participant"
          onClick={() => setPresentationRoom(dispatch, "participant")}
        >
          {participantDeskLabel(state)}
        </button>
        <button
          type="button"
          className={state.room === "mixer" ? styles.navBtnActive : styles.navBtn}
          data-demo-target="room-mixer"
          onClick={() => setPresentationRoom(dispatch, "mixer")}
        >
          Mixer
        </button>
      </nav>
      <div className={styles.spacer} />
      <div className={styles.participants} aria-label="Participants">
        {state.participants.map((p) => (
          <div key={p.id} className={styles.participantCell}>
            <button
              type="button"
              className={
                state.selectedParticipantId === p.id && state.room === "participant"
                  ? styles.avatarBtnSelected
                  : styles.avatarBtn
              }
              style={{ borderColor: p.color }}
              title={p.name}
              data-demo-target={`participant-${p.id}`}
              onClick={() => selectParticipant(dispatch, p.id)}
            >
              {participantInitial(p.name)}
            </button>
            {!compact && <span className={styles.avatarName}>{p.name}</span>}
          </div>
        ))}
      </div>
      <span
        className={
          state.sessionPhase === "performing" ? styles.phasePerforming : styles.phaseChip
        }
      >
        {state.sessionPhase === "performing" ? "Performing" : "Building"}
      </span>
      {showExchange && (
        <button
          type="button"
          className={state.exchangeOpen ? styles.exchangeBtnOpen : styles.exchangeBtn}
          data-demo-target="exchange-toggle"
          onClick={() => toggleExchange(dispatch)}
        >
          Exchange
        </button>
      )}
    </header>
  );
}
