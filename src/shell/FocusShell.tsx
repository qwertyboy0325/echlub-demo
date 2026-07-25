import type { CSSProperties, ReactNode } from "react";
import type { ShellCommand, ShellState, ViewportMode } from "./domain/shellTypes";
import { possessiveDeskTitle } from "./domain/participantWorkspace";
import { SharedClipExchange } from "../features/exchange/SharedClipExchange";
import { PresenterCaptionStrip } from "../features/presenter/PresenterCaptionStrip";
import { PresenceRail } from "../features/presenter/PresenceRail";

interface FocusShellProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  viewport: ViewportMode;
  center: ReactNode;
  bottom: ReactNode | null;
  bottomVariant?: "transport" | "dock";
  presenterCaption?: string | null;
  presenterMode?: boolean;
  walkthroughRunning?: boolean;
}

export function FocusShell({
  state,
  dispatch,
  viewport,
  center,
  bottom,
  bottomVariant = "transport",
  presenterCaption = null,
  presenterMode = false,
  walkthroughRunning = false,
}: FocusShellProps) {
  const compact = viewport === "compact";
  const showRail = viewport === "wide";
  const showDrawer = viewport === "drawer" || viewport === "compact";
  const activeParticipant = state.participants.find((p) => p.active) ?? state.participants.find((p) => p.id === state.selectedParticipantId);
  const launchedLanes = state.arrangementSlots.filter((slot) => slot.state === "playing").length;
  const inGlobal = state.room === "global";
  const inParticipant = state.room === "participant";
  const deskParticipant = state.participants.find((p) => p.id === state.selectedParticipantId);
  const deskAuditionActive = Boolean(state.deskAuditionDraftId);

  return (
    <div
      className={`focus-shell focus-shell--${viewport}${inGlobal ? " focus-shell--global-zones" : ""}${inParticipant ? " focus-shell--participant-desk" : ""}${state.sessionPhase === "performing" ? " focus-shell--performing" : ""}`}
      style={inParticipant && deskParticipant ? ({ "--desk-accent": deskParticipant.color } as CSSProperties) : undefined}
    >
      <PresenceRail state={state} dispatch={dispatch} compact={compact} />
      {inParticipant && deskParticipant && (
        <div className="focus-participant-zones" aria-label="Private desk context">
          <span className="focus-zone-chip focus-zone-chip--private-desk">Private workspace</span>
          <span className="focus-zone-chip focus-zone-chip--desk-name">
            {possessiveDeskTitle(deskParticipant.name, deskParticipant.taskProfile)}
          </span>
          <span className="focus-zone-chip focus-zone-chip--shared-dimmed">
            Shared Master · not editing here
          </span>
          {state.participantTab === "Create" && (
            <span className="focus-zone-chip focus-zone-chip--create-mode">Create · shaping clip</span>
          )}
        </div>
      )}
      {inGlobal && (
        <div className="focus-global-zones" aria-label="Global studio zones">
          <span className="focus-zone-chip focus-zone-chip--session">Workspaces</span>
          <span className="focus-zone-chip focus-zone-chip--arrangement">Arrangement</span>
          <span
            className={`focus-zone-chip focus-zone-chip--master${deskAuditionActive ? " focus-zone-chip--master-dimmed" : ""}${launchedLanes > 0 ? " focus-zone-chip--master-live" : ""}`}
          >
            Shared Master{launchedLanes > 0 ? ` · ${launchedLanes}/7` : ""}
          </span>
          {deskAuditionActive && (
            <span className="focus-zone-chip focus-zone-chip--desk-audition" data-demo-target="desk-audition-chip">
              Desk preview · local
            </span>
          )}
        </div>
      )}
      {!inGlobal && deskAuditionActive && (
        <div className="focus-shell-audition-banner" data-demo-target="desk-audition-banner" role="status">
          Desk audition · {state.deskAuditionDraftId} · not Shared Master
        </div>
      )}
      {state.sessionPhase === "performing" && (
        <div className="focus-shell-perform-banner" data-demo-target="perform-mode-banner">
          Perform · Shared Master · {launchedLanes}/7
        </div>
      )}
      <main
        className={`focus-center${inParticipant ? " focus-center--participant-desk" : ""}${walkthroughRunning && state.followActive ? " focus-center--projection-settle" : ""}`}
        style={
          walkthroughRunning && activeParticipant
            ? ({ "--projection-accent": activeParticipant.color } as CSSProperties)
            : inParticipant && deskParticipant
              ? ({ "--desk-accent": deskParticipant.color } as CSSProperties)
              : undefined
        }
      >
        {center}
      </main>
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
        <footer className={`focus-bottom focus-bottom--${bottomVariant}`}>
          <PresenterCaptionStrip
            state={state}
            caption={presenterCaption}
            presenterMode={presenterMode}
            walkthroughRunning={walkthroughRunning}
          />
          {bottom}
        </footer>
      )}
    </div>
  );
}
