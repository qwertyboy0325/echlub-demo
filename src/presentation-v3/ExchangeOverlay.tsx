import { SharedClipExchange } from "../features/exchange/SharedClipExchange";
import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";
import styles from "./styles/exchangeOverlay.module.css";

interface ExchangeOverlayProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

export function ExchangeOverlay({ state, dispatch }: ExchangeOverlayProps) {
  if (!state.exchangeOpen) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={() => dispatch({ type: "SET_EXCHANGE_OPEN", open: false })}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Shared Clip Exchange"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.panelInner}>
          <SharedClipExchange state={state} dispatch={dispatch} variant="drawer" />
        </div>
      </div>
    </div>
  );
}
