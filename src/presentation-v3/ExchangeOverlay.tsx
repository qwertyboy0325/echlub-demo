import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { V3ExchangeOverlay } from "./V3ExchangeOverlay";

interface ExchangeOverlayProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

export function ExchangeOverlay({ state, dispatch }: ExchangeOverlayProps) {
  return <V3ExchangeOverlay state={state} dispatch={dispatch} />;
}
