import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";

interface MixerPerformanceRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

export function MixerPerformanceRoom({ state, dispatch }: MixerPerformanceRoomProps) {
  void state;
  void dispatch;

  return (
    <div className="room room--mixer">
      <div className="mixer-channels" aria-label="Mixer channels">
        {["Kick", "Bass", "Lead", "FX"].map((name) => (
          <div key={name} className="mixer-channel">
            <div className="channel-meter" />
            <input type="range" className="channel-fader" min={0} max={100} defaultValue={70} aria-label={`${name} fader`} />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
