import { DockviewReact, type DockviewReadyEvent } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import type { ExchangeClip, ParticipantTab, ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { CreateEditor } from "../features/create/CreateEditor";
import { DevicesPanel } from "../features/devices/DevicesPanel";

const TABS: ParticipantTab[] = ["Create", "Devices", "Automation", "Mix", "Queue"];

interface ParticipantWorkspaceRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

function workspaceClip(state: ShellState): ExchangeClip | undefined {
  return (
    state.exchangeClips.find((c) => c.contributorId === state.selectedParticipantId) ??
    state.exchangeClips.find((c) => c.creatorId === state.selectedParticipantId)
  );
}

function TabPanel({ tab, state, dispatch }: { tab: ParticipantTab; state: ShellState; dispatch: (command: ShellCommand) => void }) {
  switch (tab) {
    case "Create":
      return <CreateEditor state={state} dispatch={dispatch} />;
    case "Devices":
      return <DevicesPanel dispatch={dispatch} draggable />;
    case "Automation":
      return <div className="automation-lane">Automation lane (fixture curves)</div>;
    case "Mix":
      return <div className="mix-panel">Mix prep — channel trim and sends (fixture)</div>;
    case "Queue":
      return <div className="queue-panel">Personal queue — handoffs to Exchange</div>;
  }
}

export function ParticipantWorkspaceRoom({ state, dispatch }: ParticipantWorkspaceRoomProps) {
  const selected = state.participants.find((p) => p.id === state.selectedParticipantId);
  const clip = workspaceClip(state);
  const creator = clip ? state.participants.find((p) => p.id === clip.creatorId) : undefined;

  return (
    <div className="room room--participant">
      <header className="participant-context">
        <strong>{clip?.title ?? "untitled-draft"}</strong>
        <span>
          r{clip?.revision ?? 1} · {creator?.name ?? selected?.name} · source:{" "}
          {clip?.forkOf ? "fork" : "personal"}
        </span>
      </header>
      <div className="participant-tabs" role="tablist" aria-label="Participant workspace">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={state.participantTab === tab}
            className={state.participantTab === tab ? "active" : ""}
            onClick={() => dispatch({ type: "SET_PARTICIPANT_TAB", tab })}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="participant-center dockview-theme-echlub">
        <DockviewReact
          className="dockview-theme-echlub"
          onReady={(event: DockviewReadyEvent) => {
            if (event.api.panels.length === 0) {
              event.api.addPanel({ id: "editor", component: "editor", title: state.participantTab });
            }
          }}
          components={{
            editor: () => <TabPanel tab={state.participantTab} state={state} dispatch={dispatch} />,
          }}
        />
      </div>
    </div>
  );
}
