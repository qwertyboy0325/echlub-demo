import { useEffect, useState } from "react";
import type { RoomId, ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { shellStore } from "../shell/domain/shellStore";
import { shellAudioAdapter } from "../shell/audio/shellAudioAdapter";
import { displayTransportBar, transportPlaybackHint } from "../shell/transportPlaybackHint";
import { useActiveLaneCount, useMusicalDomainReady, usePackMode, useShellAudioReady } from "../shell/useMusicalDraft";
import type { DeskBusId, DeskBusParams, MixParams } from "../types";

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

function filterHzToSlider(hz: number | undefined): number {
  if (hz == null) return 45;
  return Math.round(((hz - 200) / 7800) * 100);
}

function sliderToFilterHz(value: number): number {
  return 200 + (value / 100) * 7800;
}

function sendToSlider(send: number | undefined, scale: number): number {
  if (send == null) return 20;
  return Math.round((send / scale) * 100);
}

export function deskBusControlValues(
  mix: MixParams | null,
  desk: DeskBusId,
  index: number,
): {
  filter: number;
  delay: number;
  reverb: number;
  muted: boolean;
  meterLevel: number;
} {
  const deskParams: DeskBusParams | undefined = mix?.desk?.[desk];
  const delayScale = desk === "rhythm" ? 0.35 : desk === "keys" ? 0.45 : desk === "horns" ? 0.65 : 0.55;
  const reverbScale = 0.5;
  const baseMeter = shellStore.getState().transportPlaying ? 48 + index * 10 : 12;
  return {
    filter: filterHzToSlider(deskParams?.filterHz),
    delay: sendToSlider(deskParams?.delaySend, delayScale),
    reverb: sendToSlider(deskParams?.reverbSend, reverbScale),
    muted: Boolean(deskParams?.mute),
    meterLevel: deskParams?.mute ? 8 : baseMeter,
  };
}

export function useEngineMix(): MixParams | null {
  const [mix, setMix] = useState<MixParams | null>(() => shellAudioAdapter.getEngine()?.getMix() ?? null);

  useEffect(() => {
    const sync = () => setMix(shellAudioAdapter.getEngine()?.getMix() ?? null);
    sync();
    return shellStore.subscribe(sync);
  }, []);

  return mix;
}

export { sliderToFilterHz };
