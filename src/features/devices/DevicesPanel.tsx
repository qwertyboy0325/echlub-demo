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
  const [openId, setOpenId] = useState<string>("filter");
  const [values, setValues] = useState<Record<string, number>>(Object.fromEntries(DEVICES.map((d) => [d.id, d.value])));
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const setPopoverOpen = (id: string | null) => {
    setOpenId(id ?? "filter");
  };

  const setDeviceValue = (deviceId: string, value: number) => {
    setValues((prev) => ({ ...prev, [deviceId]: value }));
    dispatch?.({ type: "SET_DEVICE_PARAM", deviceId, value: value / 100 });
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
            dispatch?.({ type: "SET_INTERACTION_FROZEN", frozen: false });
          },
        },
      });
      cleanups.push(() => instance.unset());
    });
    return () => cleanups.forEach((c) => c());
  }, [dispatch, draggable]);

  const openDevice = DEVICES.find((d) => d.id === openId) ?? DEVICES[0]!;
  const openValue = values[openDevice.id] ?? openDevice.value;

  return (
    <section className="devices-panel" aria-label="Devices and effects">
      <h2>Devices</h2>
      <div className="device-rack">
        {DEVICES.map((device, index) => (
          <span key={device.id} style={{ display: "contents" }}>
            {index > 0 && <ChevronRight size={14} className="device-chain-arrow" aria-hidden />}
            <button
              type="button"
              className={`device-block param-chip${draggable ? " device-block--draggable" : ""}${openId === device.id ? " device-block--active" : ""}`}
              ref={(el) => {
                blockRefs.current[index] = el;
                if (openId === device.id) anchorRef.current = el;
              }}
              onClick={() => setPopoverOpen(device.id)}
            >
              {device.name}
            </button>
          </span>
        ))}
      </div>
      <div className="device-inspector-inline" aria-label="Device inspector">
        <div className="device-inspector-head">
          <strong>{openDevice.name}</strong>
          <span className="tabular-nums">{openDevice.param}</span>
        </div>
        <div className="device-inspector-body">
          <div className="device-knob" aria-hidden>
            <span
              className="device-knob-indicator"
              style={{ transform: `translateX(-50%) rotate(${(openValue / 100) * 270 - 135}deg)` }}
            />
          </div>
          <div className="device-inspector-controls">
            <label>
              {openDevice.param}
              <input
                type="range"
                min={0}
                max={100}
                value={openValue}
                onChange={(e) => setDeviceValue(openDevice.id, Number(e.target.value))}
              />
            </label>
            <span className="device-value tabular-nums">{openValue}</span>
            <div className="device-meter-strip" aria-hidden>
              <span style={{ width: `${openValue}%` }} />
            </div>
          </div>
        </div>
      </div>
      <div ref={popoverRef} className="device-popover device-popover--hidden" role="dialog" aria-label="Device popover" hidden />
    </section>
  );
}
