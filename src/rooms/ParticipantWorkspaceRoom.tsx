import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
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
      return (
        <div className="automation-lane">
          <div className="automation-curve" aria-hidden />
          <span className="automation-label">Filter cutoff · bass-loop · r3</span>
        </div>
      );
    case "Mix":
      return (
        <div className="mix-panel">
          <div className="mix-trim-row">
            <span className="mix-channel-name">Bass</span>
            <input type="range" min={0} max={100} defaultValue={58} aria-label="Bass trim" />
            <span className="tabular-nums mix-value">−4.2 dB</span>
          </div>
          <div className="mix-trim-row">
            <span className="mix-channel-name">Send A</span>
            <input type="range" min={0} max={100} defaultValue={22} aria-label="Send A" />
            <span className="tabular-nums mix-value">22%</span>
          </div>
        </div>
      );
    case "Queue":
      return (
        <div className="queue-panel">
          <ul className="queue-list">
            <li>melody-draft · r2 · submit for review</li>
            <li>bass-loop · r3 · ready in Exchange</li>
          </ul>
        </div>
      );
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
            <Tab key={tab} id={tab} className="participant-tab">
              {tab}
            </Tab>
          ))}
        </TabList>
        {TABS.map((tab) => (
          <TabPanel key={tab} id={tab} className="participant-tab-panel">
            <TabPanelContent tab={tab} state={state} dispatch={dispatch} />
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
