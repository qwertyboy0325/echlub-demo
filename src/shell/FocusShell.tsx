import type { ReactNode } from "react";
import type { ShellCommand, ShellState, ViewportMode } from "./domain/shellTypes";
import { SharedClipExchange } from "../features/exchange/SharedClipExchange";
import { PresenceRail } from "../features/presenter/PresenceRail";

interface FocusShellProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  viewport: ViewportMode;
  center: ReactNode;
  bottom: ReactNode | null;
  bottomVariant?: "transport" | "dock";
}

export function FocusShell({ state, dispatch, viewport, center, bottom, bottomVariant = "transport" }: FocusShellProps) {
  const compact = viewport === "compact";
  const showRail = viewport === "wide";
  const showDrawer = viewport === "drawer" || viewport === "compact";

  return (
    <div className={`focus-shell focus-shell--${viewport}`}>
      <PresenceRail state={state} dispatch={dispatch} compact={compact} />
      <main className="focus-center">{center}</main>
      {showRail && <SharedClipExchange state={state} dispatch={dispatch} variant="rail" />}
      {showDrawer && state.exchangeOpen && (
        <div className="exchange-drawer-backdrop" onClick={() => dispatch({ type: "TOGGLE_EXCHANGE" })}>
          <SharedClipExchange state={state} dispatch={dispatch} variant="drawer" />
        </div>
      )}
      {showDrawer && !state.exchangeOpen && (
        <button type="button" className="exchange-toggle" onClick={() => dispatch({ type: "TOGGLE_EXCHANGE" })}>
          Exchange
        </button>
      )}
      {bottom !== null && (
        <footer className={`focus-bottom focus-bottom--${bottomVariant}`}>{bottom}</footer>
      )}
    </div>
  );
}
