import type { CSSProperties } from "react";
import type { DeskBusId } from "../types";
import { LiveControlDock } from "../features/dock/LiveControlDock";
import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { participantInitial } from "../shell/domain/participantWorkspace";
import type { PresentationViewport } from "./presentationStateAdapter";
import styles from "./styles/mixerRoom.module.css";

const PERFORMANCE_GROUPS: Array<{
  desk: DeskBusId;
  name: string;
  owner: string;
  ownerId: string;
  color: string;
  tracks: string;
}> = [
  { desk: "rhythm", name: "Rhythm", owner: "Ryo", ownerId: "p1", color: "#f9a8d4", tracks: "Drums · Bass" },
  { desk: "keys", name: "Keys", owner: "Kai", ownerId: "p2", color: "#67e8f9", tracks: "Piano LH · RH" },
  { desk: "horns", name: "Horns", owner: "Mei", ownerId: "p3", color: "#86efac", tracks: "Alto · Tenor" },
  { desk: "guitar", name: "Guitar", owner: "Ren", ownerId: "p4", color: "#c4b5fd", tracks: "Guitar · color" },
];

interface MixerPerformanceRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  viewport: PresentationViewport;
}

export function MixerPerformanceRoom({ state, dispatch, viewport }: MixerPerformanceRoomProps) {
  const compact = viewport === "compact";
  const activeOwnerId = state.participants.find((p) => p.active)?.id;

  return (
    <section className={`${styles.room}${compact ? ` ${styles.compact}` : ""}`} aria-label="Mixer Performance">
      <div className={styles.mixerBody}>
        <header className={styles.mixerHeader}>
          <span className={styles.mixerTitle}>Performance</span>
          <span className={styles.mixerMode}>Dock: {state.dockMode}</span>
        </header>

        <div className={styles.channels}>
          {PERFORMANCE_GROUPS.map(({ desk, name, owner, ownerId, color, tracks }, index) => {
            const selected = state.selectedMixerChannel === index;
            const activeDesk = activeOwnerId === ownerId;
            const level = 52 + index * 8;
            return (
              <div
                key={desk}
                className={selected ? styles.channelSelected : styles.channel}
                data-demo-target={`desk-strip-${desk}`}
              >
                <div className={styles.channelHeader}>
                  <span className={styles.avatar} style={{ border: `2px solid ${color}` } as CSSProperties}>
                    {participantInitial(owner)}
                  </span>
                  <div>
                    <div className={styles.channelName}>{name}</div>
                    <div className={styles.channelOwner}>{owner}</div>
                    <div className={styles.channelTracks}>{tracks}</div>
                  </div>
                </div>
                <div className={styles.meter} aria-hidden>
                  <span className={styles.meterFill} style={{ height: `${level}%` }} />
                </div>
                <label className={styles.controlLabel}>
                  Filter
                  <input
                    type="range"
                    min={0}
                    max={100}
                    defaultValue={45 + index * 5}
                    aria-label={`${name} filter`}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_DESK_BUS",
                        desk,
                        params: { filterHz: 200 + (Number(event.target.value) / 100) * 7800 },
                      })
                    }
                  />
                </label>
                <div className={styles.channelActions}>
                  <button
                    type="button"
                    className={selected ? styles.channelBtnActive : styles.channelBtn}
                    onClick={() => dispatch({ type: "SELECT_MIXER_CHANNEL", channelIndex: index })}
                  >
                    Select
                  </button>
                  <button
                    type="button"
                    className={styles.channelBtn}
                    onClick={() => dispatch({ type: "SET_DESK_BUS", desk, params: { mute: true } })}
                  >
                    Mute
                  </button>
                </div>
                {activeDesk && <span className={styles.channelTracks}>Active desk</span>}
              </div>
            );
          })}
        </div>

        <div className={styles.dockWrap} data-surface="live-control-dock">
          <LiveControlDock state={state} dispatch={dispatch} compact={compact} />
        </div>
      </div>
    </section>
  );
}
