import type { CSSProperties } from "react";
import type { ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import {
  participantInitial,
  presenceActivityLabel,
  presenceActivityVerb,
  workspaceForParticipant,
} from "../../shell/domain/participantWorkspace";
import { participantDeskShortLabel } from "../../shell/participantProjection";

interface PresenceRailProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  compact: boolean;
}

function activityMetaForParticipant(
  state: ShellState,
  participantId: string,
): { activity: string; verb: string; editing: boolean; forking: boolean } {
  const participant = state.participants.find((p) => p.id === participantId);
  if (!participant) return { activity: "", verb: "", editing: false, forking: false };
  const ws = workspaceForParticipant(state, participantId);
  const clip = state.exchangeClips.find((c) => c.draftId === ws.draftId);
  const forking = Boolean(clip?.forkOf && (clip.lifecycle === "In Progress" || clip.lifecycle === "Review"));
  const activity = presenceActivityLabel(participant.name, participant.taskProfile, ws.draftId, { forking });
  const verb = presenceActivityVerb(participant.taskProfile, activity);
  return { activity, verb, editing: Boolean(ws.draftId), forking };
}

function activityForParticipant(state: ShellState, participantId: string): string {
  return activityMetaForParticipant(state, participantId).activity;
}

export function PresenceRail({ state, dispatch, compact }: PresenceRailProps) {
  const activeDesk = participantDeskShortLabel(state);

  return (
    <aside className={`presence-rail${compact ? " presence-rail--compact" : ""}`} aria-label="Participant presence">
      {!compact && <h2 className="section-label">Presence</h2>}
      {compact && state.room === "participant" && (
        <span className="presence-active-desk-chip">
          {state.selectedParticipantId
            ? activityForParticipant(state, state.selectedParticipantId)
            : activeDesk}
        </span>
      )}
      {state.participants.map((p) => {
        const { activity, verb, editing, forking } = activityMetaForParticipant(state, p.id);
        return (
          <button
            key={p.id}
            type="button"
            className={`presence-person${p.active ? " active" : ""}${editing ? " presence-person--editing" : ""}${forking ? " presence-person--forking" : ""}`}
            data-demo-target={`participant-${p.id}`}
            style={{ "--presence-accent": p.color } as CSSProperties}
            onClick={() => {
              dispatch({ type: "SELECT_PARTICIPANT", participantId: p.id });
              if (state.room === "global") dispatch({ type: "SET_ROOM", room: "participant" });
            }}
            title={activity}
          >
            <span
              className="avatar"
              style={{ boxShadow: `inset 0 0 0 1px var(--separator), 0 0 0 2px ${p.color}` }}
              aria-hidden="true"
            >
              <span className="avatar-initial">{participantInitial(p.name)}</span>
            </span>
            {!compact && (
              <span className="presence-text">
                <strong>{p.name}</strong>
                <span className="presence-activity-verb" data-presence-task={p.id}>
                  {verb}
                </span>
              </span>
            )}
            {compact && <span className="presence-compact-name">{p.name}</span>}
          </button>
        );
      })}
    </aside>
  );
}
