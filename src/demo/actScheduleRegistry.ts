import type { DemoAct } from "../domain/sessionTypes";

export type ActScheduleOwner = "production" | "canonical" | "live" | "none";

export interface ActScheduleRegistry {
  owner: ActScheduleOwner;
  liveScriptIds: number[];
  canonicalPlaybackIds: number[];
  productionTimerId: ReturnType<typeof setTimeout> | null;
}

export function createActScheduleRegistry(): ActScheduleRegistry {
  return {
    owner: "none",
    liveScriptIds: [],
    canonicalPlaybackIds: [],
    productionTimerId: null,
  };
}

export function enterAct(
  registry: ActScheduleRegistry,
  act: DemoAct,
  clearTransport: (ids: number[]) => void,
): ActScheduleOwner {
  if (registry.liveScriptIds.length) clearTransport(registry.liveScriptIds);
  if (registry.canonicalPlaybackIds.length) clearTransport(registry.canonicalPlaybackIds);
  if (registry.productionTimerId !== null) {
    clearTimeout(registry.productionTimerId);
    registry.productionTimerId = null;
  }

  const owner: ActScheduleOwner =
    act === "production" ? "production"
    : act === "canonicalPlayback" ? "canonical"
    : act === "livePerformance" ? "live"
    : "none";

  registry.owner = owner;
  registry.liveScriptIds = [];
  registry.canonicalPlaybackIds = [];
  return owner;
}

export function registerLiveSchedules(registry: ActScheduleRegistry, ids: number[]): void {
  if (registry.owner !== "live") throw new Error("Cannot register live schedules outside live act");
  registry.liveScriptIds = ids;
}

export function registerCanonicalSchedules(registry: ActScheduleRegistry, ids: number[]): void {
  if (registry.owner !== "canonical") throw new Error("Cannot register canonical schedules outside canonical act");
  registry.canonicalPlaybackIds = ids;
}
