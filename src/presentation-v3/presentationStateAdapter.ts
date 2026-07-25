import { useEffect, useState } from "react";
import type { RoomId, ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { shellStore } from "../shell/domain/shellStore";
import { displayTransportBar, transportPlaybackHint } from "../shell/transportPlaybackHint";
import { useActiveLaneCount, useMusicalDomainReady, usePackMode, useShellAudioReady } from "../shell/useMusicalDraft";

export type PresentationViewport = "wide" | "compact";

const COMPACT_BREAKPOINT = 1320;

export function resolvePresentationViewport(): PresentationViewport {
  if (typeof window === "undefined") return "wide";
  const params = new URLSearchParams(window.location.search);
  if (params.get("viewport") === "compact") return "compact";
  return window.innerWidth < COMPACT_BREAKPOINT ? "compact" : "wide";
}

export function usePresentationViewport(): PresentationViewport {
  const [viewport, setViewport] = useState<PresentationViewport>(() => resolvePresentationViewport());

  useEffect(() => {
    const onResize = () => setViewport(resolvePresentationViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return viewport;
}

export function usePresentationShell(): [ShellState, (command: ShellCommand) => void] {
  const [state, setState] = useState<ShellState>(() => shellStore.getState());

  useEffect(() => shellStore.subscribe(setState), []);

  return [state, (command) => shellStore.dispatch(command)];
}

export function useTransportHint(state: ShellState): { text: string; attention: boolean } {
  const musicalReady = useMusicalDomainReady();
  const audioReady = useShellAudioReady();
  const activeLaneCount = useActiveLaneCount();
  const packMode = usePackMode();
  return transportPlaybackHint(
    state,
    musicalReady,
    audioReady,
    activeLaneCount,
    packMode === "live-collab" ? "live-collab" : "public",
  );
}

export function formatTransportReadout(state: ShellState): string {
  return `bar ${displayTransportBar(state.transportBar)}:${state.transportBeat + 1}`;
}

export function setPresentationRoom(dispatch: (command: ShellCommand) => void, room: RoomId): void {
  dispatch({ type: "SET_ROOM", room });
}

export function toggleExchange(dispatch: (command: ShellCommand) => void): void {
  dispatch({ type: "TOGGLE_EXCHANGE" });
}

export function selectParticipant(dispatch: (command: ShellCommand) => void, participantId: string): void {
  dispatch({ type: "SELECT_PARTICIPANT", participantId });
  dispatch({ type: "SET_ROOM", room: "participant" });
}
