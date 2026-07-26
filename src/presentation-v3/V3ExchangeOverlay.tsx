import type { ExchangeClip, ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { participantInitial } from "../shell/domain/participantWorkspace";
import { thumbnailStyle } from "../ui/exchangeThumbnail";
import { stagingSlotForClip } from "./v3ExchangeHelpers";
import styles from "./styles/exchangeOverlay.module.css";

interface V3ExchangeOverlayProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

function creatorName(state: ShellState, id: string): string {
  const p = state.participants.find((entry) => entry.id === id);
  return p?.name ?? id;
}

type ContextualAction = {
  label: string;
  demoTarget: string;
  onPress: () => void;
};

function contextualExchangeAction(
  clip: ExchangeClip,
  state: ShellState,
  dispatch: (command: ShellCommand) => void,
  close: () => void,
): ContextualAction | null {
  switch (clip.lifecycle) {
    case "Available":
      if (clip.creatorId === state.selectedParticipantId && !clip.contributorId) {
        return {
          label: "Mark Ready",
          demoTarget: `exchange-ready-${clip.id}`,
          onPress: () => dispatch({ type: "MARK_READY", clipId: clip.id }),
        };
      }
      if (clip.contributorId && clip.contributorId !== clip.creatorId) {
        return {
          label: "Claim",
          demoTarget: `exchange-primary-${clip.id}`,
          onPress: () => {
            dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId: clip.id });
            dispatch({ type: "CLAIM_CLIP", clipId: clip.id });
          },
        };
      }
      return {
        label: "Fork",
        demoTarget: `exchange-primary-${clip.id}`,
        onPress: () => {
          dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId: clip.id });
          dispatch({ type: "FORK_CLIP", clipId: clip.id });
        },
      };
    case "In Progress":
      if (clip.contributorId !== state.selectedParticipantId) return null;
      return {
        label: "Submit for Review",
        demoTarget: `exchange-submit-${clip.id}`,
        onPress: () => dispatch({ type: "SUBMIT_REVIEW", clipId: clip.id }),
      };
    case "Review":
      return {
        label: "Mark Ready",
        demoTarget: `exchange-ready-${clip.id}`,
        onPress: () => dispatch({ type: "MARK_READY", clipId: clip.id }),
      };
    case "Ready": {
      const slotId = stagingSlotForClip(state, clip);
      if (!slotId) return null;
      return {
        label: "Stage for Global",
        demoTarget: `stage-clip-${slotId}`,
        onPress: () => {
          dispatch({ type: "STAGE_CLIP", clipId: clip.id, slotId });
          close();
        },
      };
    }
    default:
      return null;
  }
}

export function V3ExchangeOverlay({ state, dispatch }: V3ExchangeOverlayProps) {
  if (!state.exchangeOpen) return null;

  const clips = state.exchangeClips;
  const selected =
    state.selectedExchangeClipId
      ? clips.find((c) => c.id === state.selectedExchangeClipId)
      : clips[0] ?? null;

  const close = () => dispatch({ type: "SET_EXCHANGE_OPEN", open: false });
  const contextual = selected ? contextualExchangeAction(selected, state, dispatch, close) : null;

  return (
    <div className={styles.backdrop} role="presentation" onClick={close}>
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Shared Clip Exchange"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Exchange</h2>
          <button type="button" className={styles.closeBtn} onClick={close}>Close</button>
        </header>

        {clips.length === 0 ? (
          <div className={styles.empty}>
            <p>No shared clips yet.</p>
            <p className={styles.emptyHint}>Save and Share from a Participant desk to offer material here.</p>
          </div>
        ) : (
          <>
            <ul className={styles.list} aria-label="Shared clips">
              {clips.map((clip) => {
                const isSelected = selected?.id === clip.id;
                const creator = creatorName(state, clip.creatorId);
                return (
                  <li key={clip.id}>
                    <button
                      type="button"
                      className={isSelected ? styles.rowSelected : styles.row}
                      data-demo-target={`exchange-clip-${clip.id}`}
                      onClick={() => dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId: clip.id })}
                    >
                      <span
                        className={styles.thumb}
                        aria-hidden
                        style={thumbnailStyle(clip)}
                      />
                      <span className={styles.rowBody}>
                        <strong>{clip.title}</strong>
                        <span className={styles.meta}>
                          {creator} · r{clip.revision} · {clip.lifecycle}
                        </span>
                      </span>
                      <span className={styles.avatar}>{participantInitial(creator)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected && contextual && (
              <footer className={styles.detail}>
                <div className={styles.detailHeader}>
                  <strong>{selected.title}</strong>
                  <span className={styles.meta}>
                    r{selected.revision} · {creatorName(state, selected.creatorId)} · {selected.lifecycle}
                  </span>
                </div>
                <div className={styles.detailActions}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    data-demo-target={contextual.demoTarget}
                    onClick={contextual.onPress}
                  >
                    {contextual.label}
                  </button>
                </div>
              </footer>
            )}
          </>
        )}
      </div>
    </div>
  );
}
