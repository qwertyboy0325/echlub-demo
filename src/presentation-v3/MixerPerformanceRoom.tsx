import type { CSSProperties } from "react";
import type { DeskBusId } from "../types";
import { LiveControlDock } from "../features/dock/LiveControlDock";
import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { countPlayingLanes } from "../shell/laneSlotSemantics";
import { participantInitial } from "../shell/domain/participantWorkspace";
import {
  deskBusControlValues,
  sliderToFilterHz,
  useEngineMix,
  type PresentationViewport,
} from "./presentationStateAdapter";
import styles from "./styles/mixerRoom.module.css";

const PERFORMANCE_GROUPS: Array<{
  desk: DeskBusId;
  name: string;
  owner: string;
  ownerId: string;
  color: string;
  tracks: string;
  delayScale: number;
  reverbScale: number;
}> = [
  {
    desk: "rhythm",
    name: "Rhythm",
    owner: "Ryo",
    ownerId: "p1",
    color: "#f9a8d4",
    tracks: "Drums · Bass",
    delayScale: 0.35,
    reverbScale: 0.5,
  },
  {
    desk: "keys",
    name: "Keys",
    owner: "Kai",
    ownerId: "p2",
    color: "#67e8f9",
    tracks: "Piano LH · RH",
    delayScale: 0.45,
    reverbScale: 0.5,
  },
  {
    desk: "horns",
    name: "Horns",
    owner: "Mei",
    ownerId: "p3",
    color: "#86efac",
    tracks: "Alto · Tenor",
    delayScale: 0.65,
    reverbScale: 0.5,
  },
  {
    desk: "guitar",
    name: "Guitar",
    owner: "Ren",
    ownerId: "p4",
    color: "#c4b5fd",
    tracks: "Guitar",
    delayScale: 0.55,
    reverbScale: 0.5,
  },
];

interface MixerPerformanceRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  viewport: PresentationViewport;
}

export function MixerPerformanceRoom({ state, dispatch, viewport }: MixerPerformanceRoomProps) {
  const compact = viewport === "compact";
  const mix = useEngineMix();
  const activeOwnerId = state.participants.find((p) => p.active)?.id;
  const launchedCount = countPlayingLanes(state.arrangementSlots);
  const selectedIndex = state.selectedMixerChannel;

  return (
    <section className={`${styles.room}${compact ? ` ${styles.compact}` : ""}`} aria-label="Mixer Performance">
      <header className={styles.mixerHeader}>
        <div>
          <span className={styles.mixerTitle}>Performance mix</span>
          <span className={styles.mixerSub}>
            Shared Master · {launchedCount}/7 · Dock {state.dockMode}
          </span>
        </div>
        {selectedIndex >= 0 && (
          <span className={styles.selectedReadout}>
            Selected: {PERFORMANCE_GROUPS[selectedIndex]?.name ?? "—"}
          </span>
        )}
      </header>

      <div className={styles.mixerBody}>
        <div className={styles.channels} aria-label="Performance group strips">
          {PERFORMANCE_GROUPS.map(({ desk, name, owner, ownerId, color, tracks, delayScale, reverbScale }, index) => {
            const selected = selectedIndex === index;
            const activeDesk = activeOwnerId === ownerId;
            const controls = deskBusControlValues(mix, desk, index);
            return (
              <div
                key={desk}
                className={selected ? styles.channelSelected : styles.channel}
                data-demo-target={`desk-strip-${desk}`}
              >
                <div className={styles.channelHeader}>
                  <span
                    className={styles.avatar}
                    style={{ border: `2px solid ${color}` } as CSSProperties}
                  >
                    {participantInitial(owner)}
                  </span>
                  <div>
                    <div className={styles.channelName}>{name}</div>
                    <div className={styles.channelOwner}>{owner}</div>
                    <div className={styles.channelTracks}>{tracks}</div>
                  </div>
                </div>
                <div className={styles.meter} aria-label={`${name} level fixture`}>
                  <span
                    className={styles.meterFill}
                    style={{ height: `${controls.meterLevel}%` }}
                  />
                  <span className={styles.meterLabel}>meter</span>
                </div>
                <label className={styles.controlLabel}>
                  Filter
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={controls.filter}
                    aria-label={`${name} filter`}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_DESK_BUS",
                        desk,
                        params: { filterHz: sliderToFilterHz(Number(event.target.value)) },
                      })
                    }
                  />
                </label>
                <label className={styles.controlLabel}>
                  Delay
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={controls.delay}
                    aria-label={`${name} delay send`}
                    data-demo-target={`desk-delay-${desk}`}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_DESK_BUS",
                        desk,
                        params: { delaySend: (Number(event.target.value) / 100) * delayScale },
                      })
                    }
                  />
                </label>
                <label className={styles.controlLabel}>
                  Reverb
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={controls.reverb}
                    aria-label={`${name} reverb send`}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_DESK_BUS",
                        desk,
                        params: { reverbSend: (Number(event.target.value) / 100) * reverbScale },
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
                    data-demo-target={`desk-mute-${desk}`}
                    aria-pressed={controls.muted}
                    onClick={() =>
                      dispatch({
                        type: "SET_DESK_BUS",
                        desk,
                        params: { mute: !controls.muted },
                      })
                    }
                  >
                    {controls.muted ? "Unmute" : "Mute"}
                  </button>
                </div>
                {activeDesk && <span className={styles.activeDesk}>Active desk</span>}
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
