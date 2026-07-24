import interact from "interactjs";
import { useEffect, useRef } from "react";
import { Button } from "react-aria-components";
import type { ShellCommand, ShellState } from "../../shell/domain/shellTypes";

interface GlobalArrangementProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

export function GlobalArrangement({ state, dispatch }: GlobalArrangementProps) {
  const lanesRef = useRef<HTMLDivElement>(null);
  const readyClips = state.exchangeClips.filter((c) => c.lifecycle === "Ready");

  useEffect(() => {
    const root = lanesRef.current;
    if (!root) return;
    const cleanups: Array<() => void> = [];
    root.querySelectorAll<HTMLElement>(".arrangement-lane[data-drop-ready='true']").forEach((lane) => {
      const slotId = lane.dataset.slotId;
      if (!slotId) return;
      const instance = interact(lane).dropzone({
        accept: ".exchange-row--draggable",
        overlap: 0.35,
        ondragenter: () => lane.classList.add("arrangement-lane--drop-hover"),
        ondragleave: () => lane.classList.remove("arrangement-lane--drop-hover"),
        ondrop: (event) => {
          lane.classList.remove("arrangement-lane--drop-hover");
          const clipId = event.relatedTarget.getAttribute("data-clip-id");
          if (clipId) dispatch({ type: "STAGE_CLIP", clipId, slotId });
        },
      });
      cleanups.push(() => instance.unset());
    });
    return () => cleanups.forEach((c) => c());
  }, [dispatch, state.arrangementSlots]);

  return (
    <section className="global-arrangement" aria-label="Arrangement and launcher">
      <header className="surface-header">
        <h2>Arrangement / Launcher</h2>
        <span className="surface-note">Stage and Activate — Global only · drag Ready clips here</span>
      </header>
      <div className="arrangement-lanes" ref={lanesRef}>
        {state.arrangementSlots.map((slot) => (
          <div
            key={slot.id}
            className={`arrangement-lane arrangement-lane--${slot.state}`}
            data-slot-id={slot.id}
            data-drop-ready={slot.state === "empty" && readyClips.length > 0 ? "true" : "false"}
          >
            <div className="lane-label">{slot.label}</div>
            <div className="lane-actions">
              {readyClips.length > 0 && slot.state === "empty" && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "STAGE_CLIP", clipId: readyClips[0]!.id, slotId: slot.id })}
                >
                  Stage {readyClips[0]!.title}
                </button>
              )}
              {slot.state === "staged" && (
                <Button className="primary-btn" onPress={() => dispatch({ type: "ACTIVATE_SLOT", slotId: slot.id })}>
                  Activate
                </Button>
              )}
              {slot.state === "active" && <span className="active-badge">Active on Shared Master</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="master-strip">
        <span>Shared Master</span>
        <div className="master-meter" aria-hidden="true">
          <span className="master-meter-fill" />
        </div>
      </div>
      <ul className="activity-feed">
        {state.activityFeed.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
