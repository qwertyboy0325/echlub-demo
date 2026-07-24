import { ChevronRight } from "lucide-react";
import { computePosition, flip, offset } from "@floating-ui/dom";
import interact from "interactjs";
import { useEffect, useRef, useState } from "react";
import type { ShellCommand } from "../../shell/domain/shellTypes";

const DEVICES = [
  { id: "filter", name: "Filter", param: "Cutoff", value: 42 },
  { id: "delay", name: "Delay", param: "Wet", value: 28 },
  { id: "reverb", name: "Reverb", param: "Size", value: 55 },
];

interface DevicesPanelProps {
  dispatch?: (command: ShellCommand) => void;
  draggable?: boolean;
}

export function DevicesPanel({ dispatch, draggable = false }: DevicesPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const setPopoverOpen = (id: string | null) => {
    setOpenId(id);
    dispatch?.({ type: "SET_INTERACTION_FROZEN", frozen: id !== null });
  };

  useEffect(() => {
    if (!openId || !anchorRef.current || !popoverRef.current) return;
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    const update = () => {
      computePosition(anchor, popover, { placement: "right-start", middleware: [offset(8), flip()] }).then(({ x, y }) => {
        Object.assign(popover.style, { left: `${x}px`, top: `${y}px` });
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [openId]);

  useEffect(() => {
    if (!draggable) return;
    const cleanups: Array<() => void> = [];
    DEVICES.forEach((_device, index) => {
      const el = blockRefs.current[index];
      if (!el) return;
      const instance = interact(el).draggable({
        inertia: false,
        listeners: {
          start: () => {
            el.classList.add("device-block--dragging");
            dispatch?.({ type: "SET_INTERACTION_FROZEN", frozen: true });
          },
          move: (event) => {
            const target = event.target as HTMLElement;
            target.style.transform = `translate(${event.dx}px, ${event.dy}px)`;
          },
          end: (event) => {
            const target = event.target as HTMLElement;
            target.style.transform = "";
            el.classList.remove("device-block--dragging");
            dispatch?.({ type: "SET_INTERACTION_FROZEN", frozen: openId !== null });
          },
        },
      });
      cleanups.push(() => instance.unset());
    });
    return () => cleanups.forEach((c) => c());
  }, [dispatch, draggable, openId]);

  const openDevice = DEVICES.find((d) => d.id === openId);

  return (
    <section className="devices-panel" aria-label="Devices and effects">
      <h2>Devices</h2>
      <div className="device-rack">
        {DEVICES.map((device, index) => (
          <span key={device.id} style={{ display: "contents" }}>
            {index > 0 && (
              <ChevronRight size={14} className="device-chain-arrow" aria-hidden />
            )}
            <button
              type="button"
              className={`device-block param-chip${draggable ? " device-block--draggable" : ""}`}
              ref={(el) => {
                blockRefs.current[index] = el;
                if (index === 0) anchorRef.current = el;
              }}
              onClick={() => setPopoverOpen(openId === device.id ? null : device.id)}
            >
              {device.name}
            </button>
          </span>
        ))}
      </div>
      {openId && openDevice && (
        <div ref={popoverRef} className="device-popover" role="dialog" aria-label="Device inspector">
          <div
            className="device-knob"
            aria-hidden
          >
            <span
              className="device-knob-indicator"
              style={{ transform: `translateX(-50%) rotate(${(openDevice.value / 100) * 270 - 135}deg)` }}
            />
          </div>
          <label>
            {openDevice.param}
            <input type="range" min={0} max={100} defaultValue={openDevice.value} />
            <span className="tabular-nums">{openDevice.value}</span>
          </label>
          <button type="button" onClick={() => setPopoverOpen(null)}>
            Close
          </button>
        </div>
      )}
    </section>
  );
}
