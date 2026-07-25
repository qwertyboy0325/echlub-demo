import { ChevronRight } from "lucide-react";
import { computePosition, flip, offset } from "@floating-ui/dom";
import interact from "interactjs";
import { useEffect, useRef, useState } from "react";
import type { DeskBusId } from "../../types";
import type { ShellCommand, ShellState } from "../../shell/domain/shellTypes";

interface DeviceDef {
  id: string;
  name: string;
  param: string;
  value: number;
}

const DESK_DEVICES: Record<DeskBusId, DeviceDef[]> = {
  rhythm: [
    { id: "filter", name: "Drum Filter", param: "Cutoff", value: 48 },
    { id: "delay", name: "Room", param: "Wet", value: 12 },
  ],
  keys: [
    { id: "filter", name: "Keys Filter", param: "Cutoff", value: 55 },
    { id: "reverb", name: "Hall", param: "Size", value: 32 },
  ],
  horns: [
    { id: "delay", name: "Horns Delay", param: "Wet", value: 45 },
    { id: "reverb", name: "Plate", param: "Size", value: 28 },
  ],
  guitar: [
    { id: "filter", name: "Drive Filter", param: "Cutoff", value: 42 },
    { id: "delay", name: "Slap", param: "Wet", value: 24 },
  ],
};

const PARTICIPANT_DESK: Record<string, DeskBusId> = {
  p1: "rhythm",
  p2: "keys",
  p3: "horns",
  p4: "guitar",
};

export function deviceCountForParticipant(participantId: string): number {
  const desk = PARTICIPANT_DESK[participantId] ?? "guitar";
  return DESK_DEVICES[desk].length;
}

interface DevicesPanelProps {
  state?: ShellState;
  dispatch?: (command: ShellCommand) => void;
  draggable?: boolean;
}

export function DevicesPanel({ state, dispatch, draggable = false }: DevicesPanelProps) {
  const desk = PARTICIPANT_DESK[state?.selectedParticipantId ?? "p4"] ?? "guitar";
  const devices = DESK_DEVICES[desk];
  const [openId, setOpenId] = useState<string>(devices[0]!.id);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(devices.map((device) => [device.id, device.value])),
  );
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setOpenId(devices[0]!.id);
    setValues(Object.fromEntries(devices.map((device) => [device.id, device.value])));
  }, [desk, devices]);

  const setDeviceValue = (deviceId: string, value: number) => {
    setValues((prev) => ({ ...prev, [deviceId]: value }));
    dispatch?.({ type: "SET_DEVICE_PARAM", deviceId, value: value / 100 });
    if (deviceId === "filter") {
      dispatch?.({ type: "SET_DESK_BUS", desk, params: { filterHz: 200 + (value / 100) * 7800 } });
    }
    if (deviceId === "delay") {
      dispatch?.({ type: "SET_DESK_BUS", desk, params: { delaySend: value / 100 } });
    }
    if (deviceId === "reverb") {
      dispatch?.({ type: "SET_DESK_BUS", desk, params: { reverbSend: value / 100 } });
    }
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
    devices.forEach((_device, index) => {
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
  }, [dispatch, draggable, devices]);

  const openDevice = devices.find((device) => device.id === openId) ?? devices[0]!;
  const openValue = values[openDevice.id] ?? openDevice.value;
  const participantName = state?.participants.find((p) => p.id === state.selectedParticipantId)?.name ?? "Participant";

  return (
    <section className="devices-panel" aria-label="Devices and effects">
      <h2>
        Devices · {participantName} · {desk}
      </h2>
      <div className="device-rack">
        {devices.map((device, index) => (
          <span key={device.id} style={{ display: "contents" }}>
            {index > 0 && <ChevronRight size={14} className="device-chain-arrow" aria-hidden />}
            <button
              type="button"
              className={`device-block param-chip${draggable ? " device-block--draggable" : ""}${openId === device.id ? " device-block--active" : ""}`}
              data-demo-target={`device-${device.id}`}
              ref={(el) => {
                blockRefs.current[index] = el;
                if (openId === device.id) anchorRef.current = el;
              }}
              onClick={() => setOpenId(device.id)}
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
          <div className="device-knob" aria-hidden data-demo-target={`device-knob-${openDevice.id}`}>
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
