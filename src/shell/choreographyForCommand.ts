import type { ShellCommand } from "./domain/shellTypes";
import { deskLabelForProfile, parkedCursorLabel } from "./domain/participantWorkspace";
import { LIVE_COLLAB_LAUNCH_OPERATORS, type ShellUiTarget } from "./shellUiTargets";
import type { WalkthroughStep } from "./presenterWalkthrough";

export interface ChoreographyAction {
  participantId: string;
  target: ShellUiTarget;
  gesture: "click" | "hover";
  /** Desk-colored context for cursor badge / projection settle. */
  deskLabel: string;
}

export { parkedCursorLabel };

export function deskContextForParticipant(
  participants: Array<{ id: string; name: string; taskProfile: string }>,
  participantId: string,
): { deskLabel: string; parkedLabel: string } {
  const participant = participants.find((entry) => entry.id === participantId);
  if (!participant) {
    return { deskLabel: "Desk", parkedLabel: participantId };
  }
  const deskLabel = deskLabelForProfile(participant.taskProfile);
  return {
    deskLabel,
    parkedLabel: parkedCursorLabel(participant.name, participant.taskProfile),
  };
}

function actionFor(
  participantId: string,
  target: ShellUiTarget,
  gesture: "click" | "hover",
  deskLabel: string,
): ChoreographyAction {
  return { participantId, target, gesture, deskLabel };
}

const NAVIGATION_COMMANDS = new Set<ShellCommand["type"]>([
  "SET_PARTICIPANT_PROJECTION",
  "SET_ROOM",
  "SET_PARTICIPANT_TAB",
  "ENABLE_FOLLOW",
  "RESUME_FOLLOW",
  "SET_WORKSPACE_DRAFT",
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
  participants: Array<{ id: string; name: string; taskProfile: string }> = [],
): ChoreographyAction | null {
  const operator = resolveStepOperator(step.commands, commandIndex);
  const deskFor = (participantId: string) => deskContextForParticipant(participants, participantId).deskLabel;
  switch (command.type) {
    case "TOGGLE_STEP":
      return operator
        ? actionFor(operator, { kind: "step-cell", step: command.step }, "click", deskFor(operator))
        : null;
    case "SELECT_PIANO_NOTE":
      return operator
        ? actionFor(operator, { kind: "piano-note", noteId: command.noteId }, "click", deskFor(operator))
        : null;
    case "EDIT_NOTE_STEP":
      return operator
        ? actionFor(operator, { kind: "piano-note", noteId: command.noteId }, "click", deskFor(operator))
        : null;
    case "SET_NOTE_VELOCITY":
      return operator
        ? actionFor(operator, { kind: "velocity-slider", noteId: command.noteId }, "click", deskFor(operator))
        : null;
    case "PREVIEW_WORKSPACE": {
      const listenBeat =
        step.label.toLowerCase().includes("compare") ||
        step.label.toLowerCase().includes("audition") ||
        step.label.toLowerCase().includes("promote");
      if (operator && listenBeat) {
        const previews = step.commands.filter((entry) => entry.type === "PREVIEW_WORKSPACE");
        const previewIndex = previews.findIndex((entry) => entry === command);
        if (previewIndex === 0) {
          return actionFor(operator, { kind: "compare-listen-parent" }, "click", deskFor(operator));
        }
        if (previewIndex === 1) {
          return actionFor(operator, { kind: "compare-listen-fork" }, "click", deskFor(operator));
        }
      }
      return operator
        ? actionFor(operator, { kind: "preview-clip" }, "click", deskFor(operator))
        : null;
    }
    case "LAUNCH_SLOT": {
      const participantId = operator ?? LIVE_COLLAB_LAUNCH_OPERATORS[command.slotId] ?? "p1";
      return actionFor(participantId, { kind: "launch-slot", slotId: command.slotId }, "click", deskFor(participantId));
    }
    case "SET_DEVICE_PARAM":
      return actionFor(
        operator ?? "p4",
        { kind: "device-knob", deviceId: command.deviceId },
        "click",
        deskFor(operator ?? "p4"),
      );
    case "TOGGLE_TRANSPORT":
      return actionFor(operator ?? "p1", { kind: "transport-play" }, "click", deskFor(operator ?? "p1"));
    case "RESTART_SESSION":
      return actionFor(operator ?? "p1", { kind: "transport-restart" }, "click", deskFor(operator ?? "p1"));
    case "SHARE_CLIP":
      return operator
        ? actionFor(operator, { kind: "share-clip" }, "click", deskFor(operator))
        : null;
    case "FORK_CLIP":
      return operator
        ? actionFor(operator, { kind: "fork-clip", clipId: command.clipId }, "click", deskFor(operator))
        : null;
    case "REVISE_CLIP":
      return operator
        ? actionFor(operator, { kind: "revise-clip", clipId: command.clipId }, "click", deskFor(operator))
        : null;
    case "MARK_READY":
      return operator
        ? actionFor(operator, { kind: "accept-clip", clipId: command.clipId }, "click", deskFor(operator))
        : null;
    case "PROMOTE_CLIP":
      return operator
        ? actionFor(operator, { kind: "promote-clip", clipId: command.clipId }, "click", deskFor(operator))
        : null;
    case "STAGE_CLIP":
      return operator
        ? actionFor(operator, { kind: "stage-clip", slotId: command.slotId }, "click", deskFor(operator))
        : null;
    case "PIN_DOCK":
      return operator
        ? actionFor(operator, { kind: "dock-slot", slotIndex: command.slotIndex }, "click", deskFor(operator))
        : null;
    case "SET_DOCK_VALUE":
      return operator
        ? actionFor(operator, { kind: "dock-slot", slotIndex: command.slotIndex }, "click", deskFor(operator))
        : null;
    case "SET_DESK_BUS":
      return operator
        ? actionFor(operator, { kind: "desk-delay", desk: command.desk }, "click", deskFor(operator))
        : null;
    case "SET_LANE_MUTE":
      return operator
        ? actionFor(operator, { kind: "desk-mute", desk: "rhythm" }, "click", deskFor(operator))
        : null;
    default:
      return null;
  }
}

export function choreographyStepOrder(
  step: WalkthroughStep,
  participants: Array<{ id: string; name: string; taskProfile: string }> = [],
): Array<{
  command: ShellCommand;
  index: number;
  navigation: boolean;
  choreography: ChoreographyAction | null;
}> {
  return step.commands.map((command, index) => ({
    command,
    index,
    navigation: isNavigationCommand(command),
    choreography: isNavigationCommand(command)
      ? null
      : choreographyForCommand(command, step, index, participants),
  }));
}
