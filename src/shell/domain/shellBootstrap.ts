import { resolveShellPackMode } from "../../domain/liveCollabPack";
import { createInitialShellState } from "./shellFixtures";
import { createLiveCollabInitialShellState } from "./liveCollabShellFixtures";
import type { ShellState } from "./shellTypes";

export function createShellStateForMode(): ShellState {
  return resolveShellPackMode() === "live-collab" ? createLiveCollabInitialShellState() : createInitialShellState();
}
