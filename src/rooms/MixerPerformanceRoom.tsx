import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";

interface MixerPerformanceRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

const CHANNELS = [
  { name: "Kick", level: 72 },
  { name: "Bass", level: 58 },
  { name: "Lead", level: 81 },
  { name: "FX", level: 45 },
];

export function MixerPerformanceRoom({ state, dispatch }: MixerPerformanceRoomProps) {
  void state;
  void dispatch;

  return (
    <div className="room room--mixer" data-room="mixer">
      <div className="mixer-channels" aria-label="Mixer channels">
        {CHANNELS.map(({ name, level }) => (
          <div key={name} className="mixer-channel">
            <div className="channel-meter" aria-hidden>
              <span className="channel-meter-fill" style={{ height: `${level}%` }} />
            </div>
            <input
              type="range"
              className="channel-fader"
              min={0}
              max={100}
              defaultValue={level}
              aria-label={`${name} fader`}
            />
            <span className="mixer-channel-label">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
