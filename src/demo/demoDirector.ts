import type { ProductionAction } from "../domain/sessionTypes";

export interface DirectorFocusState {
  focusedWorkspaceIds: string[];
  collaboratorRailIds: string[];
  actLabel: string;
  layoutMode: "production" | "playback" | "performance" | "comparison";
  foldTracks: boolean;
  foldScenes: boolean;
}

const SEED = 42;

/** Deterministic presentation director — visual only, no musical authority. */
export class DemoDirector {
  private actionIndex = 0;
  private focusState: DirectorFocusState = {
    focusedWorkspaceIds: [],
    collaboratorRailIds: [],
    actLabel: "Production",
    layoutMode: "production",
    foldTracks: false,
    foldScenes: false,
  };

  reset(): void {
    this.actionIndex = 0;
    this.focusState = {
      focusedWorkspaceIds: [],
      collaboratorRailIds: [],
      actLabel: "Production",
      layoutMode: "production",
      foldTracks: false,
      foldScenes: false,
    };
  }

  getFocusState(): DirectorFocusState {
    return { ...this.focusState, focusedWorkspaceIds: [...this.focusState.focusedWorkspaceIds], collaboratorRailIds: [...this.focusState.collaboratorRailIds] };
  }

  /** Seeded ordering for repeatable recordings. */
  getOrderedActions(actions: ProductionAction[]): ProductionAction[] {
    return [...actions].sort((a, b) => a.atBeat - b.atBeat || a.id.localeCompare(b.id));
  }

  onProductionAction(action: ProductionAction, participantIds: string[]): void {
    this.actionIndex += 1;
    const railSize = 3;
    const offset = (this.actionIndex * SEED) % Math.max(1, participantIds.length);
    this.focusState.focusedWorkspaceIds = [action.workspaceId];
    this.focusState.collaboratorRailIds = participantIds
      .filter((id) => id !== action.participantId)
      .slice(offset, offset + railSize);
    if (this.focusState.collaboratorRailIds.length < railSize) {
      this.focusState.collaboratorRailIds.push(
        ...participantIds.filter((id) => id !== action.participantId).slice(0, railSize - this.focusState.collaboratorRailIds.length),
      );
    }
    this.focusState.actLabel = action.label;
    this.focusState.layoutMode = "production";
  }

  transitionToCanonicalPlayback(): void {
    this.focusState = {
      ...this.focusState,
      actLabel: "Canonical Playback",
      layoutMode: "playback",
      foldTracks: true,
      foldScenes: false,
      focusedWorkspaceIds: [],
    };
  }

  transitionToLivePerformance(): void {
    this.focusState = {
      ...this.focusState,
      actLabel: "Live Recomposition",
      layoutMode: "performance",
      foldTracks: true,
      foldScenes: true,
      focusedWorkspaceIds: [],
    };
  }

  transitionToComparison(): void {
    this.focusState = {
      ...this.focusState,
      actLabel: "Canonical vs Live Take",
      layoutMode: "comparison",
      foldTracks: false,
      foldScenes: false,
      focusedWorkspaceIds: [],
    };
  }

  applyDomFocus(root: HTMLElement): void {
    const shell = root.querySelector(".app-shell");
    if (!shell) return;
    shell.setAttribute("data-act", this.focusState.layoutMode === "playback" ? "canonicalPlayback" : this.focusState.layoutMode === "performance" ? "livePerformance" : this.focusState.layoutMode);
    shell.setAttribute("data-fold-tracks", String(this.focusState.foldTracks));
    shell.setAttribute("data-fold-scenes", String(this.focusState.foldScenes));

    const actLabel = root.querySelector("#act-label");
    if (actLabel) actLabel.textContent = this.focusState.actLabel;

    root.querySelectorAll("[data-workspace-id]").forEach((el) => {
      const id = el.getAttribute("data-workspace-id");
      el.classList.toggle("workspace-focused", id !== null && this.focusState.focusedWorkspaceIds.includes(id));
      el.classList.toggle("workspace-rail", id !== null && this.focusState.collaboratorRailIds.includes(id));
    });
  }
}
