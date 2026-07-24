import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";

interface MixerPerformanceRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

const CHANNELS = [
  { name: "Kick", clip: "pulse-r1", level: 72, pan: "C", mute: false },
  { name: "Bass", clip: "bass-loop", level: 58, pan: "L12", mute: false },
  { name: "Lead", clip: "melody-draft", level: 81, pan: "R8", mute: false },
  { name: "FX", clip: "shiki-hook", level: 45, pan: "C", mute: true },
];

export function MixerPerformanceRoom({ state, dispatch }: MixerPerformanceRoomProps) {
  return (
    <div className="room room--mixer" data-room="mixer">
      <header className="mixer-header">
        <span className="mixer-header-label">Mix pass · fixture</span>
        <span className="mixer-header-mode tabular-nums">Dock: {state.dockMode}</span>
      </header>
      <div className="mixer-channels" aria-label="Mixer channels">
        {CHANNELS.map(({ name, clip, level, pan, mute }, index) => {
          const selected = state.selectedMixerChannel === index;
          return (
            <div key={name} className={`mixer-channel${selected ? " mixer-channel--selected" : ""}`}>
              <div className="channel-top">
                <span className="mixer-channel-label">{name}</span>
                <span className="mixer-clip-context tabular-nums">{clip}</span>
              </div>
              <div className="channel-meter" aria-hidden>
                <div className="meter-scale">
                  <span>0</span>
                  <span>−12</span>
                  <span>−24</span>
                </div>
                <span className="channel-meter-fill" style={{ height: `${level}%` }} />
              </div>
              <span className="channel-fader-value tabular-nums">{level}%</span>
              <input
                type="range"
                className="channel-fader"
                min={0}
                max={100}
                defaultValue={level}
                aria-label={`${name} fader`}
              />
              <div className="channel-meta tabular-nums">
                <span>{pan}</span>
                <span>{mute ? "Muted" : "Live"}</span>
              </div>
              <div className="channel-actions">
                <button type="button" className={selected ? "active" : ""} onClick={() => dispatch({ type: "SELECT_MIXER_CHANNEL", channelIndex: index })}>
                  Select
                </button>
                <button type="button">{mute ? "Unmute" : "Solo"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
