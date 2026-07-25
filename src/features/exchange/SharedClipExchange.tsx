import { useEffect, useRef } from "react";
import Sortable from "sortablejs";
import { Button } from "react-aria-components";
import { resolveShellPackMode } from "../../domain/liveCollabPack";
import { isLaneLaunchableState } from "../../shell/laneSlotSemantics";
import type { ExchangeClip, RoomId, ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { resolveExchangeComparePair } from "./exchangeCompare";
import { ExchangeRow } from "./ExchangeRow";

function readyClipForStage(state: ShellState): ExchangeClip | null {
  const selected = state.selectedExchangeClipId
    ? state.exchangeClips.find((clip) => clip.id === state.selectedExchangeClipId)
    : null;
  if (selected?.lifecycle === "Ready") return selected;
  return state.exchangeClips.find((clip) => clip.lifecycle === "Ready") ?? null;
}

function stagingSlotForClip(state: ShellState, clip: ExchangeClip, isLiveCollab: boolean): string | null {
  const forkSlot = state.arrangementSlots.find((slot) => slot.clipId === clip.id);
  if (forkSlot) return forkSlot.id;
  if (isLiveCollab) {
    const loaded = state.arrangementSlots.find((slot) => slot.state === "loaded" && !slot.clipId);
    if (loaded) return loaded.id;
    const empty = state.arrangementSlots.find((slot) => slot.state === "empty");
    return empty?.id ?? null;
  }
  const staged = state.arrangementSlots.find((slot) => slot.state === "empty" || slot.state === "staged");
  return staged?.id ?? null;
}

function ComparePanel({
  pair,
  nameFor,
  dispatch,
  mode,
}: {
  pair: { parent: ExchangeClip; fork: ExchangeClip };
  nameFor: (id: string) => string;
  dispatch: (command: ShellCommand) => void;
  mode: "review" | "promote";
}) {
  const previewParent = () => {
    if (!pair.parent.draftId) return;
    dispatch({ type: "PREVIEW_WORKSPACE", draftId: pair.parent.draftId });
  };
  const previewFork = () => {
    if (!pair.fork.draftId) return;
    dispatch({ type: "PREVIEW_WORKSPACE", draftId: pair.fork.draftId });
  };
  const hint =
    mode === "promote"
      ? "Listen Parent / Fork before Promote — Shared Master stays"
      : "Parent vs fork before Accept";

  return (
    <section className={`exchange-compare-panel exchange-compare-panel--${mode}`} aria-label="Compare parent and fork" data-demo-target="exchange-compare">
      <header className="exchange-compare-header">
        <h3>{mode === "promote" ? "Fork audition" : "Compare"}</h3>
        <span className="exchange-compare-hint">{hint}</span>
      </header>
      <div className="exchange-compare-grid">
        <article className="exchange-compare-card exchange-compare-card--parent">
          <span className="exchange-compare-role">Parent</span>
          <strong>{pair.parent.title}</strong>
          <span className="exchange-meta tabular-nums">r{pair.parent.revision}</span>
          <span className="exchange-creator">{nameFor(pair.parent.creatorId)}</span>
        </article>
        <article className="exchange-compare-card exchange-compare-card--fork">
          <span className="exchange-compare-role">Fork</span>
          <strong>{pair.fork.title}</strong>
          <span className="exchange-meta tabular-nums">r{pair.fork.revision}</span>
          <span className="exchange-creator">{nameFor(pair.fork.contributorId ?? pair.fork.creatorId)}</span>
        </article>
      </div>
      {pair.parent.draftId && pair.fork.draftId && (
        <div className="exchange-compare-listen">
          <button type="button" className="ghost-btn" data-demo-target="compare-listen-parent" onClick={previewParent}>
            Listen Parent
          </button>
          <button type="button" className="ghost-btn" data-demo-target="compare-listen-fork" onClick={previewFork}>
            Listen Fork
          </button>
        </div>
      )}
    </section>
  );
}

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
  const isLiveCollab = resolveShellPackMode() === "live-collab";
  const readyClip = readyClipForStage(state);
  const stageSlotId = readyClip ? stagingSlotForClip(state, readyClip, isLiveCollab) : null;
  const launchableLane = state.arrangementSlots.find((slot) => isLaneLaunchableState(slot.state) && slot.state !== "queued");
  const stagedSlot = state.arrangementSlots.find((slot) => slot.state === "staged");
  const promoteClip =
    state.selectedExchangeClipId != null
      ? state.exchangeClips.find(
          (clip) => clip.id === state.selectedExchangeClipId && clip.lifecycle === "Ready" && clip.forkOf,
        )
      : null;
  const promoteSlotId = promoteClip ? stagingSlotForClip(state, promoteClip, isLiveCollab) : null;
  const performing = state.sessionPhase === "performing";

  switch (room) {
    case "global":
      return (
        <div className="exchange-room-cta">
          <Button
            className="primary-btn stage-btn"
            data-demo-target={stageSlotId ? `stage-clip-${stageSlotId}` : "stage-clip"}
            isDisabled={!readyClip || !stageSlotId}
            onPress={() => readyClip && stageSlotId && dispatch({ type: "STAGE_CLIP", clipId: readyClip.id, slotId: stageSlotId })}
          >
            Stage clip
          </Button>
          <Button
            className="stage-btn"
            isDisabled={performing || (isLiveCollab ? !launchableLane : !stagedSlot)}
            onPress={() => {
              if (performing) return;
              if (isLiveCollab && launchableLane) {
                dispatch({
                  type: "LAUNCH_SLOT",
                  slotId: launchableLane.id,
                  draftId: launchableLane.materialId ?? undefined,
                });
                return;
              }
              if (stagedSlot) dispatch({ type: "ACTIVATE_SLOT", slotId: stagedSlot.id });
            }}
          >
            {performing ? "Performing" : isLiveCollab ? "Launch lane" : "Activate slot"}
          </Button>
          {promoteClip && promoteSlotId && (
            <Button
              className="primary-btn promote-btn"
              data-demo-target={`promote-clip-${promoteClip.id}`}
              onPress={() => dispatch({ type: "PROMOTE_CLIP", clipId: promoteClip.id, slotId: promoteSlotId })}
            >
              Promote fork
            </Button>
          )}
        </div>
      );
    case "participant":
      return (
        <div className="exchange-room-cta">
          <Button
            className="ghost-btn"
            isDisabled={!clipId}
            onPress={() => {
              const clip = clipId ? state.exchangeClips.find((c) => c.id === clipId) : null;
              if (clip?.draftId) dispatch({ type: "PREVIEW_WORKSPACE", draftId: clip.draftId });
            }}
          >
            Desk audition
          </Button>
          <Button className="primary-btn" data-demo-target="share-clip" onPress={() => dispatch({ type: "SHARE_CLIP" })}>
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
  const comparePair = resolveExchangeComparePair(state);
  const compareMode =
    comparePair?.fork.lifecycle === "Ready" && comparePair.fork.forkOf ? ("promote" as const) : ("review" as const);

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
      {comparePair && <ComparePanel pair={comparePair} nameFor={nameFor} dispatch={dispatch} mode={compareMode} />}
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
