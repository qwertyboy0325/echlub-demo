import interact from "interactjs";
import { useEffect, useRef } from "react";
import type { ExchangeClip, LifecycleChip, ShellCommand } from "../../shell/domain/shellTypes";

const CHIP_CLASS: Record<LifecycleChip, string> = {
  Available: "chip-available",
  "In Progress": "chip-progress",
  Review: "chip-review",
  Ready: "chip-ready",
};

function Thumbnail({ kind }: { kind: ExchangeClip["thumbnail"] }) {
  return (
    <div className={`exchange-thumb exchange-thumb--${kind}`} aria-hidden="true">
      {kind === "steps" && <span className="exchange-thumb-steps" />}
      {kind === "notes" && <span className="exchange-thumb-notes" />}
      {kind === "wave" && <span className="exchange-thumb-wave" />}
    </div>
  );
}

interface ExchangeRowProps {
  clip: ExchangeClip;
  creatorColor: string;
  canStageDrag: boolean;
  dispatch: (command: ShellCommand) => void;
  onFork: () => void;
  onClaim: () => void;
  onReview: () => void;
  onRevise: () => void;
  onReady: () => void;
}

export function ExchangeRow({ clip, creatorColor, canStageDrag, dispatch, onFork, onClaim, onReview, onRevise, onReady }: ExchangeRowProps) {
  const rowRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || !canStageDrag) return;
    const instance = interact(el).draggable({
      inertia: false,
      listeners: {
        start: () => {
          el.classList.add("exchange-row--dragging");
          dispatch({ type: "SET_INTERACTION_FROZEN", frozen: true });
        },
        move: (event) => {
          const target = event.target as HTMLElement;
          target.style.transform = `translate(${event.dx}px, ${event.dy}px)`;
        },
        end: (event) => {
          const target = event.target as HTMLElement;
          target.style.transform = "";
          el.classList.remove("exchange-row--dragging");
          dispatch({ type: "SET_INTERACTION_FROZEN", frozen: false });
        },
      },
    });
    return () => instance.unset();
  }, [canStageDrag, dispatch]);

  return (
    <article
      ref={rowRef}
      className={`exchange-row${canStageDrag ? " exchange-row--draggable" : ""}`}
      data-clip-id={clip.id}
      style={{ borderLeftColor: creatorColor }}
    >
      <div className="exchange-row-head">
        <button type="button" className="exchange-sort-handle" aria-label="Reorder queue" title="Reorder">
          ⠿
        </button>
        <span className={`lifecycle-chip ${CHIP_CLASS[clip.lifecycle]}`}>{clip.lifecycle}</span>
        <strong>{clip.title}</strong>
        <span className="exchange-meta">r{clip.revision}</span>
      </div>
      <Thumbnail kind={clip.thumbnail} />
      {clip.forkOf && <div className="exchange-lineage">fork of {clip.forkOf}</div>}
      <div className="exchange-actions">
        <button type="button" onClick={onFork}>Fork</button>
        <button type="button" onClick={onClaim}>Claim</button>
        <button type="button" onClick={onReview}>Review</button>
        {clip.lifecycle === "Review" && (
          <button type="button" onClick={onRevise}>Revise</button>
        )}
        <button type="button" onClick={onReady}>Ready</button>
      </div>
    </article>
  );
}
