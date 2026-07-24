import interact from "interactjs";
import { useEffect, useRef } from "react";
import type { ShellCommand, ShellState } from "../../shell/domain/shellTypes";

interface LiveControlDockProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  compact: boolean;
}

function badgeClass(badge: string): string {
  if (badge === "PREVIEW") return "dock-slot-badge dock-slot-badge--preview";
  if (badge === "CAPTURE") return "dock-slot-badge dock-slot-badge--capture";
  if (badge === "MASTER") return "dock-slot-badge dock-slot-badge--master";
  return "dock-slot-badge";
}

export function LiveControlDock({ state, dispatch, compact }: LiveControlDockProps) {
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    state.dockSlots.forEach((slot, index) => {
      const el = slotRefs.current[index];
      if (!el) return;
      const instance = interact(el).dropzone({
        accept: ".device-block, .param-chip",
        ondrop: (event) => {
          const label = event.relatedTarget.textContent?.trim() || slot.label;
          dispatch({ type: "PIN_DOCK", slotIndex: index, label });
        },
      });
      cleanups.push(() => instance.unset());
    });
    return () => cleanups.forEach((c) => c());
  }, [dispatch, state.dockSlots]);

  return (
    <section
      className={`live-control-dock${compact ? " live-control-dock--compact" : ""}`}
      data-surface="live-control-dock"
      aria-label="Live Control Dock"
    >
      <header>
        <h2>Live Control Dock</h2>
        <div className="dock-legend">
          <span className="preview">Preview</span>
          <span className="capture">Capture</span>
          <span className="master">Master</span>
        </div>
      </header>
      <div className="dock-slots">
        {state.dockSlots.slice(0, compact ? 6 : 8).map((slot) => (
          <div
            key={slot.index}
            ref={(el) => {
              slotRefs.current[slot.index] = el;
            }}
            className={`dock-slot dock-slot--${slot.type}${slot.badge === "MASTER" ? " dock-slot--master" : ""}`}
            data-slot-index={slot.index}
          >
            {slot.type === "knob" && (
              <button
                type="button"
                className="dock-knob"
                aria-label={`${slot.label} knob`}
                onPointerDown={() => dispatch({ type: "SET_INTERACTION_FROZEN", frozen: true })}
                onPointerUp={() => dispatch({ type: "SET_INTERACTION_FROZEN", frozen: false })}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp")
                    dispatch({ type: "SET_DOCK_VALUE", slotIndex: slot.index, value: Math.min(1, slot.value + 0.05) });
                  if (e.key === "ArrowDown")
                    dispatch({ type: "SET_DOCK_VALUE", slotIndex: slot.index, value: Math.max(0, slot.value - 0.05) });
                }}
              >
                <span
                  className="dock-knob-face"
                  style={{ transform: `rotate(${slot.value * 270 - 135}deg)` }}
                />
              </button>
            )}
            {slot.type === "fader" && (
              <input
                type="range"
                className="dock-fader"
                min={0}
                max={100}
                value={Math.round(slot.value * 100)}
                aria-label={`${slot.label} fader`}
                onChange={(e) =>
                  dispatch({ type: "SET_DOCK_VALUE", slotIndex: slot.index, value: Number(e.target.value) / 100 })
                }
              />
            )}
            {slot.type === "toggle" && (
              <button type="button" className="dock-toggle" aria-pressed={slot.value > 0.5}>
                {slot.label}
              </button>
            )}
            {slot.type === "momentary" && (
              <button type="button" className="dock-pad">
                {slot.label}
              </button>
            )}
            <span className="dock-slot-label tabular-nums">{compact ? slot.label.slice(0, 3) : slot.label}</span>
            <span className={badgeClass(slot.badge)}>{slot.badge}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
