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
): Promise<ChoreographyRunResult> {
  const missingTargets: string[] = [];
  if (!engine) return { missingTargets };

  for (let index = 0; index < step.commands.length; index += 1) {
    const command = step.commands[index]!;
    if (isNavigationCommand(command)) continue;
    const action = choreographyForCommand(command, step, index);
    if (!action) continue;
    const result = await engine.moveAndClick(action.participantId, action.target, action.gesture);
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
): Promise<ChoreographyRunResult> {
  if (!engine || isNavigationCommand(command)) return { missingTargets: [] };
  const action: ChoreographyAction | null = choreographyForCommand(command, step, commandIndex);
  if (!action) return { missingTargets: [] };
  const result = await engine.moveAndClick(action.participantId, action.target, action.gesture);
  return { missingTargets: result.missingTarget ? [result.missingTarget] : [] };
}

export async function dispatchNavigationCommand(
  command: ShellCommand,
  dispatch: (command: ShellCommand) => void,
): Promise<void> {
  dispatch(command);
  await waitForDomPaint();
}
