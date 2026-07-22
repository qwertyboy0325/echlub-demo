import { gsap } from "gsap";
import type { BrainId, ChoreographyStep } from "./types";
import { resolveTarget } from "./uiTargets";
import { cancelTimeout, registerTimeout } from "./timerRegistry";

const brainColors: Record<BrainId, string> = {
  memory: "#67e8f9",
  pulse: "#f9a8d4",
  blend: "#86efac",
  story: "#c4b5fd",
};

interface BrainProfile {
  moveDuration: number;
  hesitation: number;
  dwellScale: number;
  ease: string;
  idle: { x: number; y: number };
}

const profiles: Record<BrainId, BrainProfile> = {
  memory: { moveDuration: 0.58, hesitation: 0.12, dwellScale: 1.2, ease: "power1.inOut", idle: { x: 24, y: 90 } },
  pulse: { moveDuration: 0.32, hesitation: 0.04, dwellScale: 0.6, ease: "power2.out", idle: { x: 30, y: 70 } },
  blend: { moveDuration: 0.85, hesitation: 0.06, dwellScale: 1.0, ease: "sine.inOut", idle: { x: 40, y: 110 } },
  story: { moveDuration: 0.62, hesitation: 0.18, dwellScale: 1.5, ease: "power2.inOut", idle: { x: 28, y: 85 } },
};

interface CursorState {
  element: HTMLElement;
  x: number;
  y: number;
  busy: boolean;
}

export class PresentationEngine {
  private cursors = new Map<BrainId, CursorState>();
  private activeTimelines: gsap.core.Timeline[] = [];
  private pendingTimers: ReturnType<typeof setTimeout>[] = [];

  private scheduleTimer(fn: () => void, ms: number): void {
    const id = registerTimeout(fn, ms);
    this.pendingTimers.push(id);
  }

  private clearPendingTimers(): void {
    this.pendingTimers.forEach((id) => cancelTimeout(id));
    this.pendingTimers = [];
  }

  initialize(): void {
    (["memory", "pulse", "blend", "story"] as BrainId[]).forEach((brain) => {
      const element = document.querySelector<HTMLElement>(`[data-cursor="${brain}"]`);
      if (!element) return;
      const profile = profiles[brain];
      this.cursors.set(brain, { element, x: profile.idle.x, y: profile.idle.y, busy: false });
    });
  }

  getActiveTimelineCount(): number {
    this.activeTimelines = this.activeTimelines.filter((tl) => tl.isActive());
    return this.activeTimelines.length;
  }

  reset(): void {
    this.clearPendingTimers();
    this.activeTimelines.forEach((tl) => tl.kill());
    this.activeTimelines = [];
    gsap.killTweensOf(".virtual-cursor, .click-ripple, .brain-window");
    this.cursors.forEach((state, brain) => {
      const profile = profiles[brain];
      state.x = profile.idle.x;
      state.y = profile.idle.y;
      state.busy = false;
      gsap.set(state.element, { x: profile.idle.x, y: profile.idle.y, opacity: 0.35, scale: 0.9 });
    });
    document.querySelectorAll(".brain-window").forEach((el) => {
      el.classList.remove("brain-active", "brain-preview");
    });
    document.querySelectorAll(".click-ripple").forEach((el) => el.remove());
  }

  executeSteps(steps: ChoreographyStep[]): void {
    const groups = new Map<string, ChoreographyStep[]>();
    for (const step of steps) {
      const key = step.concurrentGroup ?? step.eventId;
      const list = groups.get(key) ?? [];
      list.push(step);
      groups.set(key, list);
    }
    groups.forEach((groupSteps) => {
      const byActor = new Map<BrainId, ChoreographyStep[]>();
      for (const step of groupSteps) {
        const actorSteps = byActor.get(step.actor) ?? [];
        actorSteps.push(step);
        byActor.set(step.actor, actorSteps);
      }
      byActor.forEach((actorSteps) => this.executeActorChain(actorSteps));
    });
  }

  private executeActorChain(steps: ChoreographyStep[]): void {
    if (steps.length === 0) return;
    const [first, ...rest] = steps;
    this.executeStep(first);
    if (rest.length === 0) return;
    const profile = profiles[first.actor];
    const delayMs = Math.round(((first.duration ?? profile.moveDuration) + (first.dwell ?? 0.2) + 0.15) * 1000);
    this.scheduleTimer(() => this.executeActorChain(rest), delayMs);
  }

  executeStep(step: ChoreographyStep): void {
    const state = this.cursors.get(step.actor);
    if (!state) return;
    const panel = document.querySelector<HTMLElement>(`[data-brain="${step.actor}"]`);
    if (!panel) return;

    panel.classList.add("brain-active");
    const profile = profiles[step.actor];
    const targetEl = this.resolveElement(panel, step.target);
    const destEl = step.destination ? this.resolveElement(panel, step.destination) : targetEl;

    const panelRect = panel.getBoundingClientRect();
    const getCoords = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const hostPanel = el.closest(".brain-window") as HTMLElement | null;
      const hostRect = hostPanel?.getBoundingClientRect() ?? panelRect;
      return {
        x: r.left - hostRect.left + r.width * 0.55,
        y: r.top - hostRect.top + r.height * 0.5,
        panel: hostPanel ?? panel,
      };
    };

    const targetCoords = targetEl ? getCoords(targetEl) : { x: state.x, y: state.y, panel };
    const destCoords = destEl ? getCoords(destEl) : targetCoords;
    const cursorHost = targetCoords.panel ?? panel;
    if (cursorHost !== panel && state.element.parentElement !== cursorHost) {
      cursorHost.appendChild(state.element);
    }
    const duration = step.duration ?? profile.moveDuration;
    const dwell = (step.dwell ?? 0.2) * profile.dwellScale;
    const anticipation = step.anticipation ?? profile.hesitation;

    const tl = gsap.timeline({
      onComplete: () => {
        state.busy = false;
        if (!this.isBrainBusy(step.actor)) {
          this.returnToIdle(step.actor, panel);
        }
      },
    });
    this.activeTimelines.push(tl);
    state.busy = true;

    tl.to(state.element, { opacity: 1, scale: 1, duration: 0.12 });

    if (step.gesture === "cut") {
      tl.set(state.element, { x: targetCoords.x, y: targetCoords.y });
    } else if (step.gesture === "wait" || step.gesture === "idle") {
      tl.to(state.element, { duration: duration });
    } else {
      if (anticipation > 0) {
        tl.to(state.element, {
          x: state.x + (targetCoords.x - state.x) * 0.15,
          y: state.y + (targetCoords.y - state.y) * 0.15,
          duration: anticipation,
          ease: "sine.out",
        });
      }
      tl.to(state.element, {
        x: targetCoords.x,
        y: targetCoords.y,
        duration,
        ease: profile.ease,
        onUpdate: () => {
          const transform = gsap.getProperty(state.element, "x") as number;
          state.x = transform;
          state.y = gsap.getProperty(state.element, "y") as number;
        },
      });
    }

    state.x = targetCoords.x;
    state.y = targetCoords.y;

    if (step.gesture === "hover" && targetEl) {
      targetEl.classList.add("cursor-hover");
      tl.call(() => targetEl.classList.remove("cursor-hover"), [], `+=${dwell * 0.5}`);
    }

    if (["click", "doubleClick"].includes(step.gesture)) {
      tl.add(() => this.clickEffect(state.element, targetCoords, brainColors[step.actor]));
      tl.to(state.element, { scale: 0.78, duration: 0.06 });
      tl.to(state.element, { scale: 1, duration: 0.1 });
      if (targetEl) tl.add(() => targetEl.classList.add("cursor-clicked"), "-=0.1");
      if (targetEl) tl.call(() => targetEl.classList.remove("cursor-clicked"), [], `+=${dwell}`);
    }

    if (step.gesture === "drag" || step.gesture === "scrub") {
      tl.to(state.element, { scale: 0.88, duration: 0.08 }, "-=0.05");
      tl.to(state.element, {
        x: destCoords.x,
        y: destCoords.y,
        duration: duration * 1.2,
        ease: "sine.inOut",
      });
      tl.to(state.element, { scale: 1, duration: 0.1 });
      if (targetEl && destEl && destEl !== targetEl) {
        tl.add(() => targetEl.classList.add("dragging"), "-=" + (duration * 1.2));
        tl.add(() => {
          targetEl.classList.remove("dragging");
          destEl.classList.add("drop-target");
        });
        tl.call(() => destEl.classList.remove("drop-target"), [], `+=${dwell}`);
      }
    }

    if (dwell > 0 && step.gesture !== "wait") {
      tl.to({}, { duration: dwell });
    }
  }

  markPreview(brain: BrainId): void {
    document.querySelectorAll(".brain-window").forEach((el) => el.classList.remove("brain-preview"));
    document.querySelector(`[data-brain="${brain}"]`)?.classList.add("brain-preview");
  }

  clearPreview(): void {
    document.querySelectorAll(".brain-window").forEach((el) => el.classList.remove("brain-preview"));
  }

  pulseScene(sceneId: string): void {
    const card = document.querySelector<HTMLElement>(`[data-scene="${sceneId}"]`);
    if (!card) return;
    gsap.fromTo(card, { scale: 0.97 }, { scale: 1, duration: 0.5, ease: "back.out(2)" });
  }

  flashMaster(): void {
    gsap.fromTo(
      ".master-stage",
      { boxShadow: "0 0 0 rgba(103,232,249,0)" },
      { boxShadow: "0 0 56px rgba(103,232,249,.16)", duration: 0.3, yoyo: true, repeat: 1 },
    );
  }

  showBoundaryPulse(label: string): void {
    const el = document.querySelector<HTMLElement>("#boundary-countdown");
    if (!el) return;
    gsap.fromTo(el, { scale: 1.08 }, { scale: 1, duration: 0.35, ease: "back.out(3)" });
    el.dataset.phase = label.includes("Executed") ? "executed" : "counting";
  }

  private resolveElement(panel: HTMLElement, targetId: string): HTMLElement | null {
    const resolved = resolveTarget(targetId);
    if (!resolved) return panel.querySelector<HTMLElement>(`[data-target="${targetId}"]`);
    const el = panel.querySelector<HTMLElement>(resolved.selector);
    if (el) return el;
    return document.querySelector<HTMLElement>(resolved.selector);
  }

  private clickEffect(cursor: HTMLElement, coords: { x: number; y: number }, color: string): void {
    const panel = cursor.closest(".brain-window");
    if (!panel) return;
    const ripple = document.createElement("span");
    ripple.className = "click-ripple";
    ripple.style.left = `${coords.x}px`;
    ripple.style.top = `${coords.y}px`;
    ripple.style.setProperty("--ripple-color", color);
    panel.appendChild(ripple);
    gsap.fromTo(ripple, { scale: 0.3, opacity: 0.7 }, { scale: 2.2, opacity: 0, duration: 0.45, onComplete: () => ripple.remove() });
  }

  private isBrainBusy(brain: BrainId): boolean {
    return this.cursors.get(brain)?.busy ?? false;
  }

  private returnToIdle(brain: BrainId, panel: HTMLElement): void {
    const state = this.cursors.get(brain);
    if (!state) return;
    const profile = profiles[brain];
    gsap.to(state.element, { x: profile.idle.x, y: profile.idle.y, duration: 0.5, ease: "sine.out" });
    state.x = profile.idle.x;
    state.y = profile.idle.y;
    this.scheduleTimer(() => panel.classList.remove("brain-active"), 800);
  }
}
