import { useState } from "react";
import type { ParticipantTab, ShellCommand, ShellState } from "../shell/domain/shellTypes";
import {
  instrumentSummaryForProfile,
  participantInitial,
  possessiveDeskTitle,
  workspaceForParticipant,
} from "../shell/domain/participantWorkspace";
import { AutomationEditor } from "../features/automation/AutomationEditor";
import { DevicesPanel } from "../features/devices/DevicesPanel";
import { V3CreateSurface } from "./V3CreateSurface";
import type { PresentationViewport } from "./presentationStateAdapter";
import styles from "./styles/participantRoom.module.css";

const TABS: ParticipantTab[] = ["Create", "Devices", "Automation", "Mix", "Queue"];

interface ParticipantDeskRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  viewport: PresentationViewport;
}

function TabContent({
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
      return <V3CreateSurface state={state} dispatch={dispatch} />;
    case "Devices":
      return <DevicesPanel state={state} dispatch={dispatch} draggable />;
    case "Automation":
      return <AutomationEditor />;
    case "Mix":
      return (
        <div className={styles.mixPanel}>
          <div className={styles.mixRow}>
            <span>Bass trim</span>
            <input type="range" min={0} max={100} defaultValue={58} aria-label="Bass trim" />
          </div>
        </div>
      );
    case "Queue":
      return (
        <p className={styles.libraryEmpty}>
          Use the Library drawer for saved clips — Share moves material to Exchange.
        </p>
      );
  }
}

export function ParticipantDeskRoom({ state, dispatch, viewport }: ParticipantDeskRoomProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const compact = viewport === "compact";
  const selected = state.participants.find((p) => p.id === state.selectedParticipantId);
  const workspace = workspaceForParticipant(state, state.selectedParticipantId);
  const clip = state.exchangeClips.find(
    (c) => c.draftId === workspace.draftId || c.contributorId === state.selectedParticipantId,
  );
  const deskTitle = selected ? possessiveDeskTitle(selected.name, selected.taskProfile) : "Participant Desk";
  const instrumentSummary = selected ? instrumentSummaryForProfile(selected.taskProfile) : "";

  return (
    <section className={`${styles.room}${compact ? ` ${styles.compact}` : ""}`} aria-label="Participant Desk">
      <div className={styles.body}>
        <button
          type="button"
          className={styles.libraryToggle}
          onClick={() => setLibraryOpen((open) => !open)}
          aria-expanded={libraryOpen}
        >
          Library
        </button>

        <aside
          className={
            libraryOpen ? styles.libraryDrawer : `${styles.libraryDrawer} ${styles.libraryDrawerCollapsed}`
          }
          aria-label="Private library"
        >
          <div className={styles.libraryHeader}>Private clips</div>
          {workspace.libraryClips.length === 0 ? (
            <p className={styles.libraryEmpty}>Save from Create to build your library.</p>
          ) : (
            <ul className={styles.libraryList}>
              {workspace.libraryClips.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.libraryItem}
                    onClick={() => {
                      dispatch({ type: "SET_WORKSPACE_DRAFT", draftId: item.draftId });
                      dispatch({ type: "SET_PARTICIPANT_TAB", tab: "Create" });
                    }}
                  >
                    {item.title}
                    <span className={styles.libraryMeta}>r{item.revision}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className={styles.main}>
          <header className={styles.header}>
            {selected && (
              <span className={styles.avatar} style={{ border: `2px solid ${selected.color}` }}>
                {participantInitial(selected.name)}
              </span>
            )}
            <div>
              <div className={styles.deskTitle}>{deskTitle}</div>
              <div className={styles.deskSubtitle}>
                {clip?.title ?? workspace.draftId ?? "untitled"} · r{clip?.revision ?? 1}
                {instrumentSummary && ` · ${instrumentSummary}`}
              </div>
            </div>
          </header>

          <div className={styles.tabList} role="tablist" aria-label="Workspace tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={state.participantTab === tab}
                className={state.participantTab === tab ? styles.tabSelected : styles.tab}
                onClick={() => dispatch({ type: "SET_PARTICIPANT_TAB", tab })}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={styles.editor} role="tabpanel">
            <TabContent tab={state.participantTab} state={state} dispatch={dispatch} />
          </div>
        </div>
      </div>
    </section>
  );
}
