import { performanceScript } from "../performanceScript";
import { initialDrafts, scenes, TOTAL_BARS } from "../musicData";
import { allTargetIds, resolveTarget } from "../uiTargets";
import { choreographyScript } from "../choreographyScript";
import { validateHumanAuthoredCoverage } from "../choreographyCoverage";
import { SceneExecutionAuthority } from "../sceneExecution";
import { canTransitionDraft } from "../runtimeState";
import type { BrainId, DraftStatus } from "../types";

const VALID_BRAINS: BrainId[] = ["memory", "pulse", "blend", "story"];
const DRAFT_IDS = new Set(initialDrafts.map((d) => d.id));
const SCENE_IDS = new Set(scenes.map((s) => s.id));
const PATTERN_IDS = new Set(initialDrafts.filter((d) => d.kind === "drums").map((d) => d.id));

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  ref?: string;
}

export function parseTransportPosition(at: string): number {
  const [bar, beat, sixteenth] = at.split(":").map(Number);
  return bar * 16 + beat * 4 + sixteenth;
}

export function validateScriptIntegrity(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const targetIds = new Set(allTargetIds());
  choreographyScript.forEach((s) => targetIds.add(s.target));
  choreographyScript.forEach((s) => { if (s.destination) targetIds.add(s.destination); });

  let lastPos = -1;
  for (const event of performanceScript) {
    const pos = parseTransportPosition(event.at);
    if (pos < lastPos) {
      issues.push({ severity: "error", code: "ORDER", message: "Event out of order", ref: event.id });
    }
    lastPos = pos;
    if (pos > TOTAL_BARS * 16) {
      issues.push({ severity: "error", code: "RANGE", message: "Event after arrangement end", ref: event.id });
    }
    if (event.action !== "capability" && event.brain && !VALID_BRAINS.includes(event.brain)) {
      issues.push({ severity: "error", code: "BRAIN", message: `Invalid brain: ${event.brain}`, ref: event.id });
    }
    if (event.target) {
      const isDraft = DRAFT_IDS.has(event.target);
      const isScene = SCENE_IDS.has(event.target);
      const isPattern = PATTERN_IDS.has(event.target);
      const isSpecial = event.target === "silence" || event.target === "ending";
      if (!isDraft && !isScene && !isPattern && !isSpecial && event.action !== "moveNote") {
        if (!["filter", "delay", "fader", "thought", "memory", "scene"].includes(event.action)) {
          issues.push({ severity: "warning", code: "TARGET", message: `Unresolved target: ${event.target}`, ref: event.id });
        }
      }
    }
    if (event.action === "launch" && event.target && !SCENE_IDS.has(event.target)) {
      issues.push({ severity: "error", code: "LAUNCH", message: `Launch target not a scene: ${event.target}`, ref: event.id });
    }
  }

  for (const step of choreographyScript) {
    if (!resolveTarget(step.target)) {
      issues.push({ severity: "error", code: "CHOREO_TARGET", message: `Choreography target unresolved: ${step.target}`, ref: step.eventId });
    }
    if (step.destination && !resolveTarget(step.destination)) {
      issues.push({ severity: "error", code: "CHOREO_DEST", message: `Choreography destination unresolved: ${step.destination}`, ref: step.eventId });
    }
  }

  return issues;
}

export function validateDraftLifecycle(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const transitions: { draftId: string; from: DraftStatus; to: DraftStatus; eventId: string }[] = [];
  const statusByAction: Partial<Record<string, DraftStatus>> = {
    edit: "editing", preview: "preview", ready: "ready", offer: "offered", queue: "queued", launch: "playing",
  };

  for (const event of performanceScript) {
    if (!event.target || !DRAFT_IDS.has(event.target)) continue;
    const to = statusByAction[event.action];
    if (!to) continue;
    const prev = transitions.filter((t) => t.draftId === event.target).at(-1);
    const from = prev?.to ?? "editing";
    if (from === to) continue;
    if (!canTransitionDraft(from, to)) {
      issues.push({
        severity: "error",
        code: "DRAFT_TRANSITION",
        message: `Illegal transition ${from} → ${to}`,
        ref: `${event.id}:${event.target}`,
      });
    }
    transitions.push({ draftId: event.target, from, to, eventId: event.id });
  }
  return issues;
}

export function validateQueueBoundaries(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const event of performanceScript) {
    if (event.action === "queue" && event.boundary) {
      if (event.boundary.bar < 0 || event.boundary.bar > TOTAL_BARS) {
        issues.push({ severity: "error", code: "BOUNDARY", message: "Invalid execution boundary bar", ref: event.id });
      }
    }
  }
  return issues;
}

export function validateAll(): ValidationIssue[] {
  const issues = [
    ...validateScriptIntegrity(),
    ...validateDraftLifecycle(),
    ...validateQueueBoundaries(),
  ];
  const coverage = validateHumanAuthoredCoverage();
  if (!coverage.ok) {
    for (const id of coverage.missing) {
      issues.push({ severity: "error", code: "CHOREO_COVERAGE", message: `Human-authored event missing choreography: ${id}`, ref: id });
    }
    for (const t of coverage.unresolvedTargets) {
      issues.push({ severity: "error", code: "CHOREO_TARGET", message: `Unresolved choreography target: ${t}`, ref: t });
    }
  }
  const alignment = new SceneExecutionAuthority().validateLaunchAlignment(scenes);
  for (const msg of alignment) {
    issues.push({ severity: "error", code: "SCENE_ALIGN", message: msg });
  }
  return issues;
}
