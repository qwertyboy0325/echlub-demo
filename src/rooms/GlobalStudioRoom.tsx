import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { GlobalArrangement } from "../features/arrangement/GlobalArrangement";

interface GlobalStudioRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

export function GlobalStudioRoom({ state, dispatch }: GlobalStudioRoomProps) {
  return (
    <div className="room room--global" data-room="global">
      <GlobalArrangement state={state} dispatch={dispatch} />
    </div>
  );
}
