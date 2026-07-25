import interact from "interactjs";
import { useEffect, useRef } from "react";
import type { DockMode, ShellCommand, ShellState } from "../../shell/domain/shellTypes";

interface LiveControlDockProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  compact: boolean;
}

const MODES: { id: DockMode; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "capture", label: "Capture" },
  { id: "master", label: "Master" },
];

function slotModeClass(mode: DockMode, slotMapped: boolean): string {
  if (!slotMapped) return "dock-slot--empty";
  return `dock-slot--mode-${mode}`;
}

export function LiveControlDock({ state, dispatch, compact }: LiveControlDockProps) {
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    state.dockSlots.forEach((slot, index) => {
      const el = slotRefs.current[index];
      if (!el || slot.mapped) return;
      const instance = interact(el).dropzone({
        accept: ".device-block, .param-chip",
        ondrop: (event) => {
          const deviceName = event.relatedTarget.textContent?.trim() || "Param";
          dispatch({
            type: "PIN_DOCK",
            slotIndex: index,
            label: deviceName,
            sourceTrack: "Devices",
            sourceClip: "chain",
            sourceParam: `${deviceName} · Cutoff`,
          });
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
      data-dock-mode={state.dockMode}
      aria-label="Live Control Dock"
    >
      <header>
        <h2>Live Control Dock</h2>
        <div className="dock-mode-control" role="radiogroup" aria-label="Dock mode">
          {MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={state.dockMode === id}
              className={`dock-mode-btn dock-mode-btn--${id}${state.dockMode === id ? " active" : ""}`}
              onClick={() => dispatch({ type: "SET_DOCK_MODE", mode: id })}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="dock-slots">
        {state.dockSlots.slice(0, compact ? 6 : 8).map((slot) => (
          <div
            key={slot.index}
            ref={(el) => {
              slotRefs.current[slot.index] = el;
            }}
            className={`dock-slot dock-slot--${slot.type} ${slotModeClass(state.dockMode, slot.mapped)}`}
            data-slot-index={slot.index}
            data-demo-target={`dock-slot-${slot.index}`}
            data-mapped={slot.mapped ? "true" : "false"}
          >
            <span className="dock-slot-state-line" aria-hidden />
            {slot.mapped ? (
              <>
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
                    <span
                      className="dock-value-ring"
                      style={{ background: `conic-gradient(var(--focus) ${slot.value * 360}deg, transparent 0)` }}
                      aria-hidden
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
                <span className="dock-slot-label">{slot.label}</span>
                <span className="dock-source-label tabular-nums">
                  {slot.sourceTrack} · {slot.sourceClip} · {slot.sourceParam}
                </span>
                <span className="dock-slot-value tabular-nums">{Math.round(slot.value * 100)}</span>
              </>
            ) : (
              <div className="dock-empty-slot">
                <span className="dock-empty-icon" aria-hidden />
                <span className="dock-slot-label">Drop parameter</span>
                <span className="dock-source-label dock-source-label--empty">Unmapped</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
