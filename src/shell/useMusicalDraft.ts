import { useEffect, useReducer } from "react";
import { musicalDomain } from "./domain/musicalDomain";
import { shellAudioAdapter } from "./audio/shellAudioAdapter";
import type { PatternDraft } from "../types";

export function useMusicalDraft(draftId: string | null | undefined): PatternDraft | undefined {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => musicalDomain.subscribe(() => bump()), []);
  return musicalDomain.draftForId(draftId ?? null);
}

export function useMusicalDomainReady(): boolean {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => musicalDomain.subscribe(() => bump()), []);
  return musicalDomain.getPack() !== null;
}

export function useShellAudioReady(): boolean {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => shellAudioAdapter.subscribeReady(() => bump()), []);
  return shellAudioAdapter.isAudioReady();
}
