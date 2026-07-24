import { DockviewReact, type DockviewReadyEvent } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { Tab, TabList, Tabs } from "react-aria-components";
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

function TabPanelContent({
  tab,
  state,
  dispatch,
}: {
  tab: ParticipantTab;
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}) {
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
  const roomScope = state.participantTab === "Devices" ? "devices" : "participant";

  return (
    <div className="room room--participant" data-room={roomScope}>
      <header className="participant-context">
        <strong>{clip?.title ?? "untitled-draft"}</strong>
        <span>
          r{clip?.revision ?? 1} · {creator?.name ?? selected?.name} · source: {clip?.forkOf ? "fork" : "personal"}
        </span>
      </header>
      <Tabs
        selectedKey={state.participantTab}
        onSelectionChange={(key) => dispatch({ type: "SET_PARTICIPANT_TAB", tab: key as ParticipantTab })}
      >
        <TabList className="participant-tabs" aria-label="Participant workspace">
          {TABS.map((tab) => (
            <Tab key={tab} id={tab}>
              {tab}
            </Tab>
          ))}
        </TabList>
      </Tabs>
      <div className="participant-center dockview-theme-echlub">
        <DockviewReact
          className="dockview-theme-echlub"
          onReady={(event: DockviewReadyEvent) => {
            if (event.api.panels.length === 0) {
              event.api.addPanel({ id: "editor", component: "editor", title: state.participantTab });
            }
          }}
          components={{
            editor: () => <TabPanelContent tab={state.participantTab} state={state} dispatch={dispatch} />,
          }}
        />
      </div>
    </div>
  );
}
