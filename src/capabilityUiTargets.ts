export interface CapabilityUiTarget {
  id: string;
  capabilityId: string;
  selector: string;
  operation: "privateCue" | "revision";
}

/** Data-driven live targets for extended capabilities — not legacy BrainId routes. */
export const CAPABILITY_UI_TARGETS: CapabilityUiTarget[] = [
  { id: "lowend-private-cue", capabilityId: "cap-lowend", selector: '[data-target="lowend-private-cue"]', operation: "privateCue" },
  { id: "lowend-offer", capabilityId: "cap-lowend", selector: '[data-target="lowend-offer"]', operation: "revision" },
  { id: "harmony-private-cue", capabilityId: "cap-harmony", selector: '[data-target="harmony-private-cue"]', operation: "privateCue" },
  { id: "harmony-voice", capabilityId: "cap-harmony", selector: '[data-target="harmony-voice"]', operation: "revision" },
];

const targetMap = new Map(CAPABILITY_UI_TARGETS.map((t) => [t.id, t]));

export function resolveCapabilityTarget(id: string): CapabilityUiTarget | undefined {
  return targetMap.get(id);
}

export function capabilityTargetForElement(el: Element): CapabilityUiTarget | undefined {
  const cueCap = el.getAttribute("data-capability-cue");
  const offerCap = el.getAttribute("data-capability-offer");
  const capabilityId = cueCap ?? offerCap;
  if (!capabilityId) return undefined;
  const targetId = el.getAttribute("data-target") ?? undefined;
  if (targetId) {
    const byId = resolveCapabilityTarget(targetId);
    if (byId) return byId;
  }
  const operation = cueCap ? "privateCue" : "revision";
  return CAPABILITY_UI_TARGETS.find((t) => t.capabilityId === capabilityId && t.operation === operation);
}
