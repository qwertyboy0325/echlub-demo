import { GripVertical, MoreHorizontal } from "lucide-react";
import interact from "interactjs";
import { useEffect, useRef, useState } from "react";
import type { ExchangeClip, LifecycleChip, ShellCommand } from "../../shell/domain/shellTypes";
import { thumbnailStyle } from "../../ui/exchangeThumbnail";

const CHIP_CLASS: Record<LifecycleChip, string> = {
  Available: "chip-available",
  "In Progress": "chip-progress",
  Review: "chip-review",
  Ready: "chip-ready",
};

function Thumbnail({ clip }: { clip: ExchangeClip }) {
  return (
    <div className={`exchange-thumb exchange-thumb--${clip.thumbnail}`} aria-hidden="true">
      <span className={`exchange-thumb-inner exchange-thumb-${clip.thumbnail}`} style={thumbnailStyle(clip)} />
    </div>
  );
}

function primaryAction(
  clip: ExchangeClip,
): { label: string; action: "fork" | "claim" | "open" | "review" | "accept" | "preview" } {
  switch (clip.lifecycle) {
    case "Available":
      return clip.contributorId ? { label: "Claim", action: "claim" } : { label: "Fork", action: "fork" };
    case "In Progress":
      return { label: "Open work", action: "open" };
    case "Review":
      return { label: "Accept for Shared Song", action: "accept" };
    case "Ready":
      return { label: "Preview", action: "preview" };
  }
}

interface ExchangeRowProps {
  clip: ExchangeClip;
  creatorName: string;
  creatorColor: string;
  selected: boolean;
  canStageDrag: boolean;
  dispatch: (command: ShellCommand) => void;
  onFork: () => void;
  onClaim: () => void;
  onReview: () => void;
  onRevise: () => void;
  onReady: () => void;
}

export function ExchangeRow({
  clip,
  creatorName,
  creatorColor,
  selected,
  canStageDrag,
  dispatch,
  onFork,
  onClaim,
  onReview,
  onRevise,
  onReady,
}: ExchangeRowProps) {
  const rowRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const primary = primaryAction(clip);

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

  const runPrimary = () => {
    dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId: clip.id });
    if (primary.action === "fork") onFork();
    else if (primary.action === "claim") onClaim();
    else if (primary.action === "review") onReview();
    else if (primary.action === "accept") onReady();
    else if (primary.action === "open") dispatch({ type: "SET_ROOM", room: "participant" });
    else if (primary.action === "preview" && clip.draftId) {
      dispatch({ type: "PREVIEW_WORKSPACE", draftId: clip.draftId });
    }
  };

  return (
    <article
      ref={rowRef}
      className={`exchange-row${canStageDrag ? " exchange-row--draggable" : ""}${selected ? " exchange-row--selected" : ""}`}
      data-clip-id={clip.id}
      style={{ borderLeftColor: creatorColor }}
      onClick={() => dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId: clip.id })}
    >
      <div className="exchange-row-head">
        <button type="button" className="exchange-sort-handle" aria-label="Reorder queue" title="Reorder" onClick={(e) => e.stopPropagation()}>
          <GripVertical size={12} aria-hidden />
        </button>
        <Thumbnail clip={clip} />
        <div className="exchange-row-meta-block">
          <div className="exchange-row-title-line">
            <strong>{clip.title}</strong>
            <span className="exchange-meta tabular-nums">r{clip.revision}</span>
          </div>
          <div className="exchange-row-provenance">
            <span className={`lifecycle-chip ${CHIP_CLASS[clip.lifecycle]}`}>{clip.lifecycle}</span>
            <span className="exchange-creator">{creatorName}</span>
            {clip.forkOf && <span className="exchange-lineage">fork of {clip.forkOf}</span>}
          </div>
        </div>
      </div>
      <div className="exchange-actions">
        <button
          type="button"
          className="primary-btn exchange-primary-action"
          data-demo-target={
            primary.action === "fork"
              ? `fork-clip-${clip.id}`
              : primary.action === "claim"
                ? `claim-clip-${clip.id}`
                : primary.action === "accept"
                  ? `accept-clip-${clip.id}`
                  : undefined
          }
          onClick={(e) => {
            e.stopPropagation();
            runPrimary();
          }}
        >
          {primary.label}
        </button>
        {clip.lifecycle === "Review" && (
          <button
            type="button"
            className="exchange-revise-btn"
            data-demo-target={`revise-clip-${clip.id}`}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId: clip.id });
              onRevise();
            }}
          >
            Revise
          </button>
        )}
        {clip.lifecycle !== "Ready" && (
          <button type="button" className="exchange-preview-btn" onClick={(e) => { e.stopPropagation(); dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId: clip.id }); }}>
            Preview
          </button>
        )}
        <div className="exchange-overflow">
          <button type="button" className="exchange-overflow-trigger" aria-label="More actions" onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}>
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="exchange-overflow-menu" role="menu">
              {clip.lifecycle === "Available" && (
                <>
                  <button
                    type="button"
                    data-demo-target={`fork-clip-${clip.id}`}
                    onClick={() => {
                      onFork();
                      setMenuOpen(false);
                    }}
                  >
                    Fork
                  </button>
                  <button type="button" onClick={() => { onClaim(); setMenuOpen(false); }}>Claim</button>
                </>
              )}
              {clip.lifecycle === "In Progress" && (
                <button type="button" onClick={() => { onReview(); setMenuOpen(false); }}>Submit for review</button>
              )}
              {clip.lifecycle === "Review" && (
                <>
                  <button type="button" onClick={() => { onRevise(); setMenuOpen(false); }}>Revise</button>
                  <button
                    type="button"
                    data-demo-target={`accept-clip-${clip.id}`}
                    onClick={() => {
                      onReady();
                      setMenuOpen(false);
                    }}
                  >
                    Accept for Shared Song
                  </button>
                </>
              )}
              {clip.lifecycle === "Ready" && (
                <button type="button" onClick={() => { dispatch({ type: "SET_ROOM", room: "global" }); setMenuOpen(false); }}>Stage in Global</button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
