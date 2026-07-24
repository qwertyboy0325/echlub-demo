import { useEffect, useRef } from "react";
import Sortable from "sortablejs";
import type { ExchangeClip, ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { ExchangeRow } from "./ExchangeRow";

interface SharedClipExchangeProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  variant: "rail" | "drawer";
}

export function SharedClipExchange({ state, dispatch, variant }: SharedClipExchangeProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const sortable = Sortable.create(el, {
      animation: 150,
      handle: ".exchange-sort-handle",
      draggable: ".exchange-row",
      onEnd: () => {
        const ids = [...el.querySelectorAll<HTMLElement>(".exchange-row")]
          .map((row) => row.dataset.clipId)
          .filter(Boolean) as string[];
        dispatch({ type: "REORDER_EXCHANGE", clipIds: ids });
      },
    });
    return () => sortable.destroy();
  }, [dispatch]);

  const colorFor = (id: string) => state.participants.find((p) => p.id === id)?.color ?? "#4a9eff";

  return (
    <aside className={`exchange-panel exchange-panel--${variant}`} aria-label="Shared Clip Exchange">
      <header className="exchange-header">
        <h2>Shared Clip Exchange</h2>
        {variant === "drawer" && (
          <button type="button" className="ghost-btn" onClick={() => dispatch({ type: "TOGGLE_EXCHANGE" })}>
            Close
          </button>
        )}
      </header>
      <div className="exchange-list" ref={listRef}>
        {state.exchangeClips.map((clip: ExchangeClip) => (
          <ExchangeRow
            key={clip.id}
            clip={clip}
            creatorColor={colorFor(clip.creatorId)}
            canStageDrag={state.room === "global" && clip.lifecycle === "Ready"}
            dispatch={dispatch}
            onFork={() => dispatch({ type: "FORK_CLIP", clipId: clip.id })}
            onClaim={() => dispatch({ type: "CLAIM_CLIP", clipId: clip.id })}
            onReview={() => dispatch({ type: "SUBMIT_REVIEW", clipId: clip.id })}
            onRevise={() => dispatch({ type: "REVISE_CLIP", clipId: clip.id })}
            onReady={() => dispatch({ type: "MARK_READY", clipId: clip.id })}
          />
        ))}
      </div>
      <button type="button" className="primary-btn" onClick={() => dispatch({ type: "SHARE_CLIP" })}>
        Share revision
      </button>
    </aside>
  );
}
