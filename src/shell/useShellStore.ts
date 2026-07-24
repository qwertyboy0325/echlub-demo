import { useEffect, useState } from "react";
import type { ShellCommand, ShellState } from "./domain/shellTypes";
import { shellStore } from "./domain/shellStore";

export function useShellStore(): [ShellState, (command: ShellCommand) => void] {
  const [state, setState] = useState<ShellState>(() => shellStore.getState());

  useEffect(() => shellStore.subscribe(setState), []);

  return [state, (command) => shellStore.dispatch(command)];
}
