import { choreographyScript, stepsForEvent } from "./choreographyScript";
import { performanceScript } from "./performanceScript";
import { classifyEvent, requiresChoreography } from "./eventClassification";
import { resolveTarget } from "./uiTargets";
import type { PerformanceScriptEvent } from "./types";

export interface ChoreographyCoverageRow {
  eventId: string;
  actor: string;
  action: string;
  classification: string;
  choreographyStepIds: string[];
  uiTargetIds: string[];
  runtimeMutation: string;
  audioConsequence: string;
  coverageStatus: "covered" | "exempt" | "missing";
}

function audioConsequenceFor(event: PerformanceScriptEvent): string {
  switch (event.action) {
    case "launch": return `Scene audio at ${event.at} via SceneExecutionAuthority`;
    case "filter": return "Pre-transition masterFilter (automation)";
    case "delay": return "Pre-transition delay.wet (automation)";
    case "fader": return `Layer gain ${event.target}`;
    case "preview": return "Private preview bus (no master scene change)";
    default: return "No direct master scene change";
  }
}

function runtimeMutationFor(event: PerformanceScriptEvent): string {
  return `applyScriptEvent → ${event.action}${event.target ? `(${event.target})` : ""}`;
}

export function buildChoreographyCoverage(): ChoreographyCoverageRow[] {
  return performanceScript.map((event) => {
    const classification = classifyEvent(event);
    const steps = stepsForEvent(event.id);
    const stepIds = steps.map((s) => s.eventId);
    const targets = [...new Set(steps.map((s) => s.target).concat(event.target ? [event.target] : []))];
    const needs = requiresChoreography(event);
    const covered = !needs || steps.length > 0;
    return {
      eventId: event.id,
      actor: event.brain ?? event.capabilityId ?? "—",
      action: event.action,
      classification,
      choreographyStepIds: stepIds,
      uiTargetIds: targets,
      runtimeMutation: runtimeMutationFor(event),
      audioConsequence: audioConsequenceFor(event),
      coverageStatus: !needs ? "exempt" : covered ? "covered" : "missing",
    };
  });
}

export function validateHumanAuthoredCoverage(): { ok: boolean; missing: string[]; unresolvedTargets: string[] } {
  const rows = buildChoreographyCoverage();
  const missing = rows.filter((r) => r.coverageStatus === "missing").map((r) => r.eventId);
  const unresolvedTargets: string[] = [];
  for (const step of choreographyScript) {
    if (!resolveTarget(step.target)) unresolvedTargets.push(step.target);
    if (step.destination && !resolveTarget(step.destination)) unresolvedTargets.push(step.destination);
  }
  return { ok: missing.length === 0 && unresolvedTargets.length === 0, missing, unresolvedTargets };
}

export function formatCoverageMarkdown(): string {
  const rows = buildChoreographyCoverage();
  const human = rows.filter((r) => r.classification === "human_authored");
  const covered = human.filter((r) => r.coverageStatus === "covered").length;
  const lines = [
    "# Choreography Coverage",
    "",
    `Generated from performanceScript (${rows.length} events) and choreographyScript (${choreographyScript.length} steps).`,
    "",
    `**Human-authored coverage:** ${covered}/${human.length} (${human.length ? Math.round((covered / human.length) * 100) : 100}%)`,
    "",
    "| Event | Actor | Action | Class | Steps | Status |",
    "|-------|-------|--------|-------|-------|--------|",
  ];
  for (const r of rows) {
    lines.push(`| ${r.eventId} | ${r.actor} | ${r.action} | ${r.classification} | ${r.choreographyStepIds.join(", ") || "—"} | ${r.coverageStatus} |`);
  }
  lines.push("", "## Detail", "");
  for (const r of rows) {
    lines.push(`### ${r.eventId} — ${r.action}`);
    lines.push(`- Classification: ${r.classification}`);
    lines.push(`- UI targets: ${r.uiTargetIds.join(", ") || "—"}`);
    lines.push(`- Runtime: ${r.runtimeMutation}`);
    lines.push(`- Audio: ${r.audioConsequence}`);
    lines.push("");
  }
  return lines.join("\n");
}
