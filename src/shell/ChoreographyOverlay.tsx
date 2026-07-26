import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { ShellState } from "./domain/shellTypes";
import {
  participantsToChoreographyCast,
  ShellChoreographyEngine,
} from "./choreographyEngine";

export interface ChoreographyOverlayHandle {
  engine: ShellChoreographyEngine | null;
}

interface ChoreographyOverlayProps {
  active: boolean;
  participants: ShellState["participants"];
  onReady?: (handle: ChoreographyOverlayHandle) => void;
}

export function ChoreographyOverlay({ active, participants, onReady }: ChoreographyOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ShellChoreographyEngine | null>(null);
  const castKey = useMemo(
    () => participants.map((p) => `${p.id}:${p.name}:${p.color}`).join("|"),
    [participants],
  );
  const cast = useMemo(() => participantsToChoreographyCast(participants), [castKey]);

  useEffect(() => {
    if (!overlayRef.current) return;
    const engine = new ShellChoreographyEngine(overlayRef.current, cast);
    engineRef.current = engine;
    onReady?.({ engine });
    return () => {
      engine.dispose();
      engineRef.current = null;
      onReady?.({ engine: null });
    };
  }, [cast, onReady]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (active) {
      engine.show();
      engine.parkAllOnRail();
    } else {
      engine.hide();
    }
  }, [active]);

  return createPortal(
    <div
      ref={overlayRef}
      className={`choreography-overlay${active ? " choreography-overlay--visible" : ""}`}
      aria-hidden={!active}
      data-surface="choreography-overlay"
    />,
    document.body,
  );
}
