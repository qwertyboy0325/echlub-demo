import type { ShellChoreographyEngine } from "../../shell/choreographyEngine";
import type { ShellCommand } from "../../shell/domain/shellTypes";
import { waitForDomPaint } from "../../shell/choreographyEngine";
import { dispatchNavigationCommand } from "../../shell/choreographyRunner";
import { musicalDomain } from "../../shell/domain/musicalDomain";
import { shellStore } from "../../shell/domain/shellStore";
import {
  projectionCommandLabel,
  recordV3ActionSuccess,
  recordV3TargetFailure,
} from "./v3PresenterEvidence";
import { resolveV3Target, type V3TargetFailure } from "./v3TargetResolver";
import { V3_TARGET_SELECTORS, V3_UI_TARGET_KEYS, type V3UiTargetKey } from "./v3UiTargets";

export type V3ActionMode = "formal" | "dev";

const PROJECTION_COMMANDS = new Set<ShellCommand["type"]>([
  "SET_PARTICIPANT_PROJECTION",
  "ENABLE_FOLLOW",
  "RESUME_FOLLOW",
]);

export function isProjectionCommand(command: ShellCommand): boolean {
  return PROJECTION_COMMANDS.has(command.type);
}

export class V3ActionExecutionError extends Error {
  readonly failure: V3TargetFailure;

  constructor(failure: V3TargetFailure) {
    super(`V3 target ${failure.key} ${failure.reason} (${failure.selector})`);
    this.failure = failure;
  }
}

export async function executeV3Click(
  engine: ShellChoreographyEngine | null,
  participantId: string,
  key: V3UiTargetKey,
  beatId: string,
  mode: V3ActionMode,
  deskLabel?: string,
): Promise<void> {
  const state = shellStore.getState();
  const resolved = resolveV3Target(key, { beatId, participantId, state });
  if ("reason" in resolved) {
    recordV3TargetFailure(resolved);
    if (mode === "formal") throw new V3ActionExecutionError(resolved);
    return;
  }

  if (engine) {
    const result = await engine.moveAndActivateSelector(
      participantId,
      resolved.selector,
      "click",
      deskLabel,
    );
    if (!result.hit) {
      const failure: V3TargetFailure = {
        key,
        selector: resolved.selector,
        reason: "missing",
        beatId,
        participantId,
        room: state.room,
        exchangeOpen: state.exchangeOpen,
        participantTab: state.participantTab,
      };
      recordV3TargetFailure(failure);
      if (mode === "formal") throw new V3ActionExecutionError(failure);
      return;
    }
  } else {
    resolved.interactable.click();
  }

  await waitForDomPaint();
  recordV3ActionSuccess(`click:${key}`, `activated ${key}`);
}

export async function executeV3Scrub(
  engine: ShellChoreographyEngine | null,
  participantId: string,
  key: V3UiTargetKey,
  percent: number,
  beatId: string,
  mode: V3ActionMode,
  deskLabel?: string,
): Promise<void> {
  const state = shellStore.getState();
  const resolved = resolveV3Target(key, { beatId, participantId, state });
  if ("reason" in resolved) {
    recordV3TargetFailure(resolved);
    if (mode === "formal") throw new V3ActionExecutionError(resolved);
    return;
  }

  if (engine) {
    const result = await engine.moveAndScrubSelector(
      participantId,
      resolved.selector,
      percent,
      deskLabel,
    );
    if (!result.hit) {
      const failure: V3TargetFailure = {
        key,
        selector: resolved.selector,
        reason: "missing",
        beatId,
        participantId,
        room: state.room,
        exchangeOpen: state.exchangeOpen,
        participantTab: state.participantTab,
      };
      recordV3TargetFailure(failure);
      if (mode === "formal") throw new V3ActionExecutionError(failure);
      return;
    }
  } else if (resolved.interactable instanceof HTMLInputElement) {
    const min = Number(resolved.interactable.min) || 0;
    const max = Number(resolved.interactable.max) || 100;
    const value = min + (percent / 100) * (max - min);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(resolved.interactable, String(value));
    resolved.interactable.dispatchEvent(new Event("input", { bubbles: true }));
    resolved.interactable.dispatchEvent(new Event("change", { bubbles: true }));
  }

  await waitForDomPaint();
  recordV3ActionSuccess(`scrub:${key}→${percent}`, `${key} at ${percent}%`);
}

export async function executeV3KnobSteps(
  engine: ShellChoreographyEngine | null,
  participantId: string,
  key: V3UiTargetKey,
  steps: number,
  direction: "up" | "down",
  beatId: string,
  mode: V3ActionMode,
): Promise<void> {
  const state = shellStore.getState();
  const resolved = resolveV3Target(key, { beatId, participantId, state });
  if ("reason" in resolved) {
    recordV3TargetFailure(resolved);
    if (mode === "formal") throw new V3ActionExecutionError(resolved);
    return;
  }

  if (engine) {
    await engine.moveAndKnobSteps(participantId, resolved.selector, steps, direction);
  } else {
    resolved.interactable.focus();
    const arrow = direction === "up" ? "ArrowUp" : "ArrowDown";
    for (let i = 0; i < steps; i += 1) {
      resolved.interactable.dispatchEvent(
        new KeyboardEvent("keydown", { key: arrow, bubbles: true }),
      );
    }
  }
  await waitForDomPaint();
  recordV3ActionSuccess(`knob:${key}:${direction}x${steps}`);
}

export async function executeV3Projection(
  command: ShellCommand,
  _beatId: string,
  mode: V3ActionMode,
): Promise<void> {
  if (!isProjectionCommand(command)) {
    if (mode === "formal") {
      throw new Error(`projection adapter rejected ${command.type}`);
    }
    return;
  }
  await dispatchNavigationCommand(command, shellStore.dispatch.bind(shellStore));
  recordV3ActionSuccess(`projection:${command.type}`, projectionCommandLabel(command));
}

export async function waitAfterBars(bars: number, epoch: number): Promise<void> {
  if (bars <= 0) return;
  const startBar = shellStore.getState().transportBar;
  const targetBar = startBar + bars;
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (musicalDomain.getRestartEpoch() !== epoch && epoch > 0) {
        resolve();
        return;
      }
      if (shellStore.getState().transportBar >= targetBar) {
        resolve();
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

export async function waitUntilTransportBar(targetBar: number, epoch: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (musicalDomain.getRestartEpoch() !== epoch && epoch > 0) {
        resolve();
        return;
      }
      if (shellStore.getState().transportBar >= targetBar) {
        resolve();
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

export function v3TargetResolutionReport(): {
  keys: readonly V3UiTargetKey[];
  selectors: Record<V3UiTargetKey, string>;
} {
  return { keys: V3_UI_TARGET_KEYS, selectors: V3_TARGET_SELECTORS };
}
