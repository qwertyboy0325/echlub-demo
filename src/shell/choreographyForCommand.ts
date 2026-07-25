import type { ShellCommand } from "./domain/shellTypes";
import { LIVE_COLLAB_LAUNCH_OPERATORS, type ShellUiTarget } from "./shellUiTargets";
import type { WalkthroughStep } from "./presenterWalkthrough";

export interface ChoreographyAction {
  participantId: string;
  target: ShellUiTarget;
  gesture: "click" | "hover";
}

const NAVIGATION_COMMANDS = new Set<ShellCommand["type"]>([
  "SET_PARTICIPANT_PROJECTION",
  "SET_ROOM",
  "SET_PARTICIPANT_TAB",
  "ENABLE_FOLLOW",
  "RESUME_FOLLOW",
]);

export function isNavigationCommand(command: ShellCommand): boolean {
  return NAVIGATION_COMMANDS.has(command.type);
}

export function resolveStepOperator(commands: ShellCommand[], commandIndex: number): string | null {
  for (let i = commandIndex - 1; i >= 0; i -= 1) {
    const command = commands[i]!;
    if (command.type === "SET_PARTICIPANT_PROJECTION") return command.participantId;
    if (command.type === "SELECT_PARTICIPANT") return command.participantId;
  }
  return null;
}

export function choreographyForCommand(
  command: ShellCommand,
  step: WalkthroughStep,
  commandIndex: number,
): ChoreographyAction | null {
  const operator = resolveStepOperator(step.commands, commandIndex);
  switch (command.type) {
    case "TOGGLE_STEP":
      return operator
        ? { participantId: operator, target: { kind: "step-cell", step: command.step }, gesture: "click" }
        : null;
    case "PREVIEW_WORKSPACE":
      return operator
        ? { participantId: operator, target: { kind: "preview-clip" }, gesture: "click" }
        : null;
    case "LAUNCH_SLOT": {
      const participantId = operator ?? LIVE_COLLAB_LAUNCH_OPERATORS[command.slotId] ?? "p1";
      return { participantId, target: { kind: "launch-slot", slotId: command.slotId }, gesture: "click" };
    }
    case "SET_DEVICE_PARAM":
      return {
        participantId: operator ?? "p4",
        target: { kind: "device-knob", deviceId: command.deviceId },
        gesture: "click",
      };
    case "TOGGLE_TRANSPORT":
      return { participantId: operator ?? "p1", target: { kind: "transport-play" }, gesture: "click" };
    case "RESTART_SESSION":
      return { participantId: operator ?? "p1", target: { kind: "transport-restart" }, gesture: "click" };
    case "SHARE_CLIP":
      return operator
        ? { participantId: operator, target: { kind: "share-clip" }, gesture: "click" }
        : null;
    case "STAGE_CLIP":
      return operator
        ? { participantId: operator, target: { kind: "stage-clip" }, gesture: "click" }
        : null;
    default:
      return null;
  }
}

export function choreographyStepOrder(step: WalkthroughStep): Array<{
  command: ShellCommand;
  index: number;
  navigation: boolean;
  choreography: ChoreographyAction | null;
}> {
  return step.commands.map((command, index) => ({
    command,
    index,
    navigation: isNavigationCommand(command),
    choreography: isNavigationCommand(command) ? null : choreographyForCommand(command, step, index),
  }));
}
