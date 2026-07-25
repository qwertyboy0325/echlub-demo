import type { ShellCommand } from "./domain/shellTypes";
import type { ChoreographyAction } from "./choreographyForCommand";
import { choreographyForCommand, isNavigationCommand } from "./choreographyForCommand";
import { waitForDomPaint } from "./choreographyEngine";
import type { ShellChoreographyEngine } from "./choreographyEngine";
import type { WalkthroughStep } from "./presenterWalkthrough";

export interface ChoreographyRunResult {
  missingTargets: string[];
}

export async function runStepChoreography(
  step: WalkthroughStep,
  engine: ShellChoreographyEngine | null,
  participants: Array<{ id: string; name: string; taskProfile: string }> = [],
): Promise<ChoreographyRunResult> {
  const missingTargets: string[] = [];
  if (!engine) return { missingTargets };

  for (let index = 0; index < step.commands.length; index += 1) {
    const command = step.commands[index]!;
    if (isNavigationCommand(command)) continue;
    const action = choreographyForCommand(command, step, index, participants);
    if (!action) continue;
    const result = await engine.moveAndClick(
      action.participantId,
      action.target,
      action.gesture,
      action.deskLabel,
    );
    if (!result.hit && result.missingTarget) {
      missingTargets.push(result.missingTarget);
    }
  }

  return { missingTargets };
}

export async function runCommandChoreography(
  command: ShellCommand,
  step: WalkthroughStep,
  commandIndex: number,
  engine: ShellChoreographyEngine | null,
  participants: Array<{ id: string; name: string; taskProfile: string }> = [],
): Promise<ChoreographyRunResult> {
  if (!engine || isNavigationCommand(command)) return { missingTargets: [] };
  const action: ChoreographyAction | null = choreographyForCommand(command, step, commandIndex, participants);
  if (!action) return { missingTargets: [] };
  const result = await engine.moveAndClick(
    action.participantId,
    action.target,
    action.gesture,
    action.deskLabel,
  );
  return { missingTargets: result.missingTarget ? [result.missingTarget] : [] };
}

const PROJECTION_SETTLE_MS = 360;

export async function dispatchNavigationCommand(
  command: ShellCommand,
  dispatch: (command: ShellCommand) => void,
): Promise<void> {
  dispatch(command);
  await waitForDomPaint();
  if (
    command.type === "SET_PARTICIPANT_PROJECTION" ||
    command.type === "SET_ROOM" ||
    command.type === "ENABLE_FOLLOW" ||
    command.type === "RESUME_FOLLOW"
  ) {
    await new Promise<void>((resolve) => setTimeout(resolve, PROJECTION_SETTLE_MS));
  }
}
