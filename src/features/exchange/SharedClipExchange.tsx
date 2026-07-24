import { useEffect, useRef } from "react";
import Sortable from "sortablejs";
import { Button } from "react-aria-components";
import type { ExchangeClip, RoomId, ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { ExchangeRow } from "./ExchangeRow";

interface SharedClipExchangeProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  variant: "rail" | "drawer";
}

function RoomCta({ room, state, dispatch }: { room: RoomId; state: ShellState; dispatch: (command: ShellCommand) => void }) {
  const clipId =
    state.exchangeClips.find((c) => c.contributorId === state.selectedParticipantId)?.id ??
    state.exchangeClips[0]?.id ??
    null;

  switch (room) {
    case "global":
      return (
        <div className="exchange-room-cta">
          <Button className="primary-btn stage-btn" onPress={() => dispatch({ type: "SET_ROOM", room: "global" })}>
            Stage clip
          </Button>
          <Button className="stage-btn" onPress={() => dispatch({ type: "SET_ROOM", room: "global" })}>
            Activate slot
          </Button>
        </div>
      );
    case "participant":
      return (
        <div className="exchange-room-cta">
          <Button className="ghost-btn" isDisabled={!clipId} onPress={() => clipId && dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId })}>
            Preview
          </Button>
          <Button className="primary-btn" onPress={() => dispatch({ type: "SHARE_CLIP" })}>
            Share revision
          </Button>
          <Button isDisabled={!clipId} onPress={() => clipId && dispatch({ type: "SUBMIT_REVIEW", clipId })}>
            Submit for review
          </Button>
        </div>
      );
    case "mixer":
      return (
        <div className="exchange-room-cta">
          <Button className="ghost-btn" onPress={() => dispatch({ type: "SET_DOCK_MODE", mode: "preview" })}>
            Preview movement
          </Button>
          <Button className="primary-btn" onPress={() => dispatch({ type: "SET_DOCK_MODE", mode: "capture" })}>
            Capture movement
          </Button>
          <Button onPress={() => dispatch({ type: "SET_DOCK_MODE", mode: "master" })}>
            Submit mix pass
          </Button>
        </div>
      );
  }
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

  const colorFor = (id: string) => state.participants.find((p) => p.id === id)?.color ?? "var(--muted)";
  const nameFor = (id: string) => state.participants.find((p) => p.id === id)?.name ?? id;

  return (
    <aside className={`exchange-panel exchange-panel--${variant}`} aria-label="Shared Clip Exchange">
      <header className="exchange-header">
        <h2>Shared Clip Exchange</h2>
        {variant === "drawer" && (
          <button type="button" className="ghost-btn exchange-drawer-close" onClick={() => dispatch({ type: "TOGGLE_EXCHANGE" })}>
            Close
          </button>
        )}
      </header>
      <div className="exchange-list" ref={listRef}>
        {state.exchangeClips.map((clip: ExchangeClip) => (
          <ExchangeRow
            key={clip.id}
            clip={clip}
            creatorName={nameFor(clip.creatorId)}
            creatorColor={colorFor(clip.creatorId)}
            selected={state.selectedExchangeClipId === clip.id}
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
      <RoomCta room={state.room} state={state} dispatch={dispatch} />
    </aside>
  );
}
