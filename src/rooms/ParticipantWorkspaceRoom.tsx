import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import type { CSSProperties } from "react";
import type { ExchangeClip, ParticipantTab, ShellCommand, ShellState } from "../shell/domain/shellTypes";
import {
  deskLabelForProfile,
  instrumentSummaryForProfile,
  participantInitial,
  possessiveDeskTitle,
  workspaceForParticipant,
} from "../shell/domain/participantWorkspace";
import { AutomationEditor } from "../features/automation/AutomationEditor";
import { CreateEditor } from "../features/create/CreateEditor";
import { DevicesPanel } from "../features/devices/DevicesPanel";

const TABS: ParticipantTab[] = ["Create", "Devices", "Automation", "Mix", "Queue"];

interface ParticipantWorkspaceRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

function workspaceClip(state: ShellState): ExchangeClip | undefined {
  const draftId = workspaceForParticipant(state, state.selectedParticipantId).draftId;
  if (draftId) {
    const byDraft = state.exchangeClips.find((c) => c.draftId === draftId);
    if (byDraft) return byDraft;
  }
  return (
    state.exchangeClips.find((c) => c.contributorId === state.selectedParticipantId) ??
    state.exchangeClips.find((c) => c.creatorId === state.selectedParticipantId)
  );
}

function ownedTrackLabels(state: ShellState, participantId: string): string[] {
  const ws = workspaceForParticipant(state, participantId);
  return ws.ownedTrackIds.map((trackId) => {
    const track = state.arrangementTracks.find((entry) => entry.id === trackId);
    return track?.name ?? trackId.replace(/^track-/, "").replace(/-/g, " ");
  });
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
      return <DevicesPanel state={state} dispatch={dispatch} draggable />;
    case "Automation":
      return <AutomationEditor />;
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
  const workspace = workspaceForParticipant(state, state.selectedParticipantId);
  const ownedTracks = ownedTrackLabels(state, state.selectedParticipantId);
  const roomScope = state.participantTab === "Devices" ? "devices" : "participant";
  const deskTitle = selected ? possessiveDeskTitle(selected.name, selected.taskProfile) : "Participant Desk";
  const instrumentSummary = selected ? instrumentSummaryForProfile(selected.taskProfile) : "";

  return (
    <div
      className="room room--participant"
      data-room={roomScope}
      data-participant-id={selected?.id}
      data-desk-profile={selected?.taskProfile}
      style={selected ? ({ "--desk-accent": selected.color } as CSSProperties) : undefined}
    >
      <div className="participant-desk-zone" aria-label={`${deskTitle} private workspace`}>
      <header className="participant-desk-header">
        <span className="participant-desk-private-badge">Private workspace</span>
        <div className="participant-desk-identity">
          <span
            className="participant-desk-avatar"
            style={{ boxShadow: `inset 0 0 0 1px var(--separator), 0 0 0 2px ${selected?.color ?? "var(--separator)"}` }}
            aria-hidden="true"
          >
            {selected ? participantInitial(selected.name) : "?"}
          </span>
          <div className="participant-desk-titles">
            <strong className="participant-desk-title">{deskTitle}</strong>
            <span className="participant-desk-subtitle">
              {instrumentSummary && <span className="participant-desk-instrument">{instrumentSummary} · </span>}
              {clip?.title ?? workspace.draftId ?? "untitled-draft"} · r{clip?.revision ?? 1} ·{" "}
              {clip?.forkOf ? "fork" : "personal"} · not Shared Master
            </span>
          </div>
        </div>
        {ownedTracks.length > 0 && (
          <div className="participant-owned-tracks" aria-label="Owned tracks">
            {ownedTracks.map((label) => (
              <span key={label} className="participant-owned-chip">
                {label}
              </span>
            ))}
          </div>
        )}
        {selected && (
          <span className="participant-desk-profile">{deskLabelForProfile(selected.taskProfile)}</span>
        )}
        {state.recallRole && state.workspaceDraftId && (
          <span className="recall-role-chip" data-demo-target="recall-role-chip">
            Recall · {state.workspaceDraftId} → {state.recallRole}
          </span>
        )}
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
    </div>
  );
}
