import type { CSSProperties } from "react";
import type { DeskBusId } from "../types";
import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { participantInitial } from "../shell/domain/participantWorkspace";

interface MixerPerformanceRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

const PERFORMANCE_GROUPS: Array<{
  desk: DeskBusId;
  name: string;
  owner: string;
  ownerId: string;
  color: string;
  tracks: string;
}> = [
  {
    desk: "rhythm",
    name: "Rhythm",
    owner: "Ryo",
    ownerId: "p1",
    color: "var(--participant-ryo)",
    tracks: "Drums · Bass",
  },
  {
    desk: "keys",
    name: "Keys",
    owner: "Kai",
    ownerId: "p2",
    color: "var(--participant-kai)",
    tracks: "Piano LH · RH",
  },
  {
    desk: "horns",
    name: "Horns",
    owner: "Mei",
    ownerId: "p3",
    color: "var(--participant-mei)",
    tracks: "Alto · Tenor",
  },
  {
    desk: "guitar",
    name: "Guitar",
    owner: "Ren",
    ownerId: "p4",
    color: "var(--participant-ren)",
    tracks: "Guitar · color",
  },
];

export function MixerPerformanceRoom({ state, dispatch }: MixerPerformanceRoomProps) {
  const activeOwnerId = state.participants.find((p) => p.active)?.id;

  return (
    <div className="room room--mixer" data-room="mixer">
      <header className="mixer-header">
        <span className="mixer-header-label">Performance groups</span>
        <span className="mixer-header-mode tabular-nums">Dock: {state.dockMode}</span>
      </header>
      <div className="mixer-channels" aria-label="Performance group strips">
        {PERFORMANCE_GROUPS.map(({ desk, name, owner, ownerId, color, tracks }, index) => {
          const selected = state.selectedMixerChannel === index;
          const activeDesk = activeOwnerId === ownerId;
          const level = 52 + index * 8;
          return (
            <div
              key={desk}
              className={`mixer-channel mixer-channel--desk${selected ? " mixer-channel--selected" : ""}${activeDesk ? " mixer-channel--active-desk" : ""}`}
              data-demo-target={`desk-strip-${desk}`}
              style={{ "--desk-accent": color } as CSSProperties}
            >
              <div className="mixer-desk-header">
                <span
                  className="mixer-desk-avatar"
                  style={{ boxShadow: `inset 0 0 0 1px var(--separator), 0 0 0 2px ${color}` }}
                  aria-hidden="true"
                >
                  {participantInitial(owner)}
                </span>
                <div className="channel-top">
                  <span className="mixer-channel-label">{name}</span>
                  <strong className="mixer-desk-owner-name">{owner}</strong>
                  <span className="mixer-clip-context tabular-nums">{tracks}</span>
                </div>
              </div>
              <div className="channel-meter" aria-hidden>
                <span className="channel-meter-fill" style={{ height: `${level}%` }} />
              </div>
              <div className="desk-strip-controls">
                <label>
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
                <label>
                  Delay
                  <input
                    type="range"
                    min={0}
                    max={100}
                    defaultValue={20 + index * 10}
                    aria-label={`${name} delay send`}
                    data-demo-target={`desk-delay-${desk}`}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_DESK_BUS",
                        desk,
                        params: { delaySend: Number(event.target.value) / 100 },
                      })
                    }
                  />
                </label>
                <label>
                  Reverb
                  <input
                    type="range"
                    min={0}
                    max={100}
                    defaultValue={15 + index * 8}
                    aria-label={`${name} reverb send`}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_DESK_BUS",
                        desk,
                        params: { reverbSend: Number(event.target.value) / 100 },
                      })
                    }
                  />
                </label>
              </div>
              <div className="channel-actions">
                <button
                  type="button"
                  className={selected ? "active" : ""}
                  onClick={() => dispatch({ type: "SELECT_MIXER_CHANNEL", channelIndex: index })}
                >
                  Select
                </button>
                <button
                  type="button"
                  data-demo-target={`desk-mute-${desk}`}
                  onClick={() =>
                    dispatch({
                      type: "SET_DESK_BUS",
                      desk,
                      params: { mute: true },
                    })
                  }
                >
                  Mute
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
