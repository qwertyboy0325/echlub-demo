import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { participantInitial } from "../shell/domain/participantWorkspace";
import { thumbnailStyle } from "../ui/exchangeThumbnail";
import {
  primaryExchangeAction,
  readyClipForStage,
  stagingSlotForClip,
} from "./v3ExchangeHelpers";
import styles from "./styles/exchangeOverlay.module.css";

interface V3ExchangeOverlayProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

function creatorName(state: ShellState, id: string): string {
  const p = state.participants.find((entry) => entry.id === id);
  return p?.name ?? id;
}

export function V3ExchangeOverlay({ state, dispatch }: V3ExchangeOverlayProps) {
  if (!state.exchangeOpen) return null;

  const clips = state.exchangeClips;
  const selected =
    state.selectedExchangeClipId
      ? clips.find((c) => c.id === state.selectedExchangeClipId)
      : clips[0] ?? null;
  const readyClip = readyClipForStage(state);
  const stageSlotId = readyClip ? stagingSlotForClip(state, readyClip) : null;

  const close = () => dispatch({ type: "SET_EXCHANGE_OPEN", open: false });

  const runPrimary = (clip: NonNullable<typeof selected>) => {
    dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId: clip.id });
    const action = primaryExchangeAction(clip);
    switch (action.kind) {
      case "fork":
        dispatch({ type: "FORK_CLIP", clipId: clip.id });
        break;
      case "claim":
        dispatch({ type: "CLAIM_CLIP", clipId: clip.id });
        break;
      case "accept":
        dispatch({ type: "MARK_READY", clipId: clip.id });
        break;
      case "preview":
        if (clip.draftId) dispatch({ type: "PREVIEW_WORKSPACE", draftId: clip.draftId });
        break;
      case "open":
        dispatch({ type: "SET_ROOM", room: "participant" });
        close();
        break;
    }
  };

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

            {selected && (
              <footer className={styles.detail}>
                <div className={styles.detailHeader}>
                  <strong>{selected.title}</strong>
                  <span className={styles.meta}>
                    r{selected.revision} · {creatorName(state, selected.creatorId)}
                  </span>
                </div>
                <div className={styles.detailActions}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => runPrimary(selected)}
                  >
                    {primaryExchangeAction(selected).label}
                  </button>
                  {selected.lifecycle === "Ready" && stageSlotId && (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      data-demo-target={`stage-clip-${stageSlotId}`}
                      onClick={() => {
                        dispatch({ type: "STAGE_CLIP", clipId: selected.id, slotId: stageSlotId });
                        close();
                      }}
                    >
                      Stage for Global
                    </button>
                  )}
                </div>
              </footer>
            )}
          </>
        )}
      </div>
    </div>
  );
}
