import { gsap } from "gsap";
import { cancelTimeout, registerTimeout } from "../timerRegistry";
import { parkedCursorLabel } from "./domain/participantWorkspace";
import { resolveShellUiTarget, selectorForShellUiTarget, type ShellUiTarget } from "./shellUiTargets";

export type ParticipantMotionProfile = "snappy" | "smooth" | "deliberate" | "medium";

export interface ChoreographyParticipant {
  id: string;
  name: string;
  color: string;
  taskProfile: string;
  motionProfile: ParticipantMotionProfile;
}

interface CursorState {
  element: HTMLElement;
  x: number;
  y: number;
  busy: boolean;
}

interface Profile {
  moveDuration: number;
  hesitation: number;
  ease: string;
}

const MOTION_PROFILES: Record<ParticipantMotionProfile, Profile> = {
  snappy: { moveDuration: 0.32, hesitation: 0.04, ease: "power2.out" },
  smooth: { moveDuration: 0.85, hesitation: 0.06, ease: "sine.inOut" },
  deliberate: { moveDuration: 0.62, hesitation: 0.18, ease: "power2.inOut" },
  medium: { moveDuration: 0.58, hesitation: 0.12, ease: "power1.inOut" },
};

const PARTICIPANT_PROFILES: Record<string, ParticipantMotionProfile> = {
  p1: "snappy",
  p2: "smooth",
  p3: "deliberate",
  p4: "medium",
};

function profileFor(participantId: string): Profile {
  const motion = PARTICIPANT_PROFILES[participantId] ?? "medium";
  return MOTION_PROFILES[motion];
}

function participantInitial(participant: ChoreographyParticipant): string {
  return participant.name.charAt(0).toUpperCase();
}

export function waitForDomPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export class ShellChoreographyEngine {
  private readonly overlay: HTMLElement;
  private readonly participants: ChoreographyParticipant[];
  private readonly cursors = new Map<string, CursorState>();
  private activeTimelines: gsap.core.Timeline[] = [];
  private pendingTimers: ReturnType<typeof setTimeout>[] = [];
  private visible = false;

  constructor(overlay: HTMLElement, participants: ChoreographyParticipant[]) {
    this.overlay = overlay;
    this.participants = participants;
    this.mountCursors();
  }

  private mountCursors(): void {
    this.overlay.replaceChildren();
    for (const participant of this.participants) {
      const element = document.createElement("div");
      element.className = "virtual-cursor shell-virtual-cursor shell-virtual-cursor--parked";
      element.dataset.participantCursor = participant.id;
      element.style.setProperty("--cursor-color", participant.color);
      element.innerHTML = `<i></i><b>${participantInitial(participant)}</b><span class="cursor-status-label">${parkedCursorLabel(participant.name, participant.taskProfile)}</span>`;
      gsap.set(element, { x: 0, y: 0, opacity: 0, scale: 0.9 });
      this.overlay.appendChild(element);
      this.cursors.set(participant.id, { element, x: 0, y: 0, busy: false });
    }
  }

  show(): void {
    this.visible = true;
    this.overlay.classList.add("choreography-overlay--visible");
  }

  hide(): void {
    this.visible = false;
    this.reset();
    this.overlay.classList.remove("choreography-overlay--visible");
  }

  dispose(): void {
    this.hide();
    this.overlay.replaceChildren();
    this.cursors.clear();
  }

  reset(): void {
    this.pendingTimers.forEach((id) => cancelTimeout(id));
    this.pendingTimers = [];
    this.activeTimelines.forEach((tl) => tl.kill());
    this.activeTimelines = [];
    gsap.killTweensOf(".shell-virtual-cursor, .click-ripple");
    this.overlay.querySelectorAll(".click-ripple").forEach((el) => el.remove());
    this.cursors.forEach((state) => {
      state.busy = false;
      gsap.set(state.element, { opacity: 0, scale: 0.9 });
    });
  }

  private scheduleTimer(fn: () => void, ms: number): void {
    this.pendingTimers.push(registerTimeout(fn, ms));
  }

  private overlayPointFor(target: ShellUiTarget): { x: number; y: number; element: HTMLElement | null } {
    const element = resolveShellUiTarget(target);
    if (!element) return { x: 0, y: 0, element: null };
    const rect = element.getBoundingClientRect();
    const overlayRect = this.overlay.getBoundingClientRect();
    return {
      x: rect.left - overlayRect.left + rect.width * 0.55,
      y: rect.top - overlayRect.top + rect.height * 0.5,
      element,
    };
  }

  private parkOnRail(participantId: string): void {
    const state = this.cursors.get(participantId);
    if (!state) return;
    const railTarget = resolveShellUiTarget({ kind: "participant", participantId });
    if (!railTarget) {
      gsap.to(state.element, { opacity: 0, duration: 0.2 });
      return;
    }
    const coords = this.overlayPointFor({ kind: "participant", participantId });
    state.element.classList.add("shell-virtual-cursor--parked");
    state.element.classList.remove("shell-virtual-cursor--active");
    gsap.to(state.element, {
      x: coords.x,
      y: coords.y,
      opacity: 0.42,
      scale: 0.92,
      duration: 0.45,
      ease: "sine.out",
    });
    state.x = coords.x;
    state.y = coords.y;
  }

  private updatePresence(participantId: string): void {
    for (const id of this.cursors.keys()) {
      if (id !== participantId) this.parkOnRail(id);
    }
  }

  private overlayPointForElement(element: HTMLElement): { x: number; y: number } {
    const rect = element.getBoundingClientRect();
    const overlayRect = this.overlay.getBoundingClientRect();
    return {
      x: rect.left - overlayRect.left + rect.width * 0.55,
      y: rect.top - overlayRect.top + rect.height * 0.5,
    };
  }

  private async animateToElement(
    participantId: string,
    element: HTMLElement,
    gesture: "click" | "hover" | "scrub",
    deskLabel?: string,
  ): Promise<void> {
    const state = this.cursors.get(participantId);
    if (!state || !this.visible) return;

    this.updatePresence(participantId);
    state.element.classList.remove("shell-virtual-cursor--parked");
    state.element.classList.add("shell-virtual-cursor--active");
    if (deskLabel) state.element.dataset.deskContext = deskLabel;

    const coords = this.overlayPointForElement(element);
    const profile = profileFor(participantId);
    const color =
      this.participants.find((p) => p.id === participantId)?.color ?? "var(--focus)";

    await new Promise<void>((resolve) => {
      state.busy = true;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        state.busy = false;
        resolve();
      };
      const safety = window.setTimeout(finish, 6000);
      const tl = gsap.timeline({
        onComplete: () => {
          window.clearTimeout(safety);
          finish();
        },
      });
      this.activeTimelines.push(tl);
      tl.to(state.element, { opacity: 1, scale: 1, duration: 0.12 });
      if (profile.hesitation > 0 && gesture !== "scrub") {
        tl.to(state.element, {
          x: state.x + (coords.x - state.x) * 0.15,
          y: state.y + (coords.y - state.y) * 0.15,
          duration: profile.hesitation,
          ease: "sine.out",
        });
      }
      const scrubEndX =
        gesture === "scrub" && element instanceof HTMLInputElement
          ? coords.x + (element.valueAsNumber / (Number(element.max) || 100)) * element.clientWidth * 0.35
          : coords.x;
      tl.to(state.element, {
        x: scrubEndX,
        y: coords.y,
        duration: gesture === "scrub" ? profile.moveDuration * 1.4 : profile.moveDuration,
        ease: profile.ease,
        onUpdate: () => {
          state.x = gsap.getProperty(state.element, "x") as number;
          state.y = gsap.getProperty(state.element, "y") as number;
        },
      });
      if (gesture === "click") {
        tl.add(() => this.clickRipple(coords.x, coords.y, color));
        tl.to(state.element, { scale: 0.78, duration: 0.06 });
        tl.to(state.element, { scale: 1, duration: 0.1 });
        tl.add(() => element.classList.add("cursor-clicked"));
        tl.call(() => element.classList.remove("cursor-clicked"), [], "+=0.2");
      } else if (gesture === "hover") {
        tl.add(() => element.classList.add("cursor-hover"));
        tl.call(() => element.classList.remove("cursor-hover"), [], "+=0.25");
      }
      state.x = scrubEndX;
      state.y = coords.y;
    });
  }

  /** V3 evidence path: animate cursor then invoke the real control handler via DOM activation. */
  async moveAndActivateSelector(
    participantId: string,
    selector: string,
    gesture: "click" | "hover" = "click",
    deskLabel?: string,
  ): Promise<{ hit: boolean; missingTarget: string | null }> {
    if (!this.visible) return { hit: false, missingTarget: null };
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return { hit: false, missingTarget: selector };
    await this.animateToElement(participantId, element, gesture, deskLabel);
    if (gesture === "click") element.click();
    return { hit: true, missingTarget: null };
  }

  async moveAndScrubSelector(
    participantId: string,
    selector: string,
    percent: number,
    deskLabel?: string,
  ): Promise<{ hit: boolean; missingTarget: string | null }> {
    if (!this.visible) return { hit: false, missingTarget: null };
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return { hit: false, missingTarget: selector };
    await this.animateToElement(participantId, element, "scrub", deskLabel);
    if (element instanceof HTMLInputElement && element.type === "range") {
      const min = Number(element.min) || 0;
      const max = Number(element.max) || 100;
      const value = min + (percent / 100) * (max - min);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(element, String(value));
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return { hit: true, missingTarget: null };
  }

  async moveAndKnobSteps(
    participantId: string,
    selector: string,
    steps: number,
    direction: "up" | "down",
    deskLabel?: string,
  ): Promise<{ hit: boolean; missingTarget: string | null }> {
    if (!this.visible) return { hit: false, missingTarget: null };
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return { hit: false, missingTarget: selector };
    await this.animateToElement(participantId, element, "scrub", deskLabel);
    element.focus();
    const key = direction === "up" ? "ArrowUp" : "ArrowDown";
    for (let i = 0; i < steps; i += 1) {
      element.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
    }
    return { hit: true, missingTarget: null };
  }

  async moveAndClick(
    participantId: string,
    target: ShellUiTarget,
    gesture: "click" | "hover" = "click",
    deskLabel?: string,
  ): Promise<{ hit: boolean; missingTarget: string | null }> {
    if (!this.visible) return { hit: false, missingTarget: null };
    const state = this.cursors.get(participantId);
    if (!state) return { hit: false, missingTarget: null };

    this.updatePresence(participantId);
    state.element.classList.remove("shell-virtual-cursor--parked");
    state.element.classList.add("shell-virtual-cursor--active");
    if (deskLabel) state.element.dataset.deskContext = deskLabel;
    const coords = this.overlayPointFor(target);
    if (!coords.element) {
      return { hit: false, missingTarget: selectorForShellUiTarget(target) };
    }

    const profile = profileFor(participantId);
    const color =
      this.participants.find((p) => p.id === participantId)?.color ?? "var(--focus)";

    await new Promise<void>((resolve) => {
      state.busy = true;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        state.busy = false;
        resolve();
      };
      const safety = window.setTimeout(finish, 6000);
      const tl = gsap.timeline({
        onComplete: () => {
          window.clearTimeout(safety);
          finish();
        },
      });
      this.activeTimelines.push(tl);

      tl.to(state.element, { opacity: 1, scale: 1, duration: 0.12 });
      if (profile.hesitation > 0) {
        tl.to(state.element, {
          x: state.x + (coords.x - state.x) * 0.15,
          y: state.y + (coords.y - state.y) * 0.15,
          duration: profile.hesitation,
          ease: "sine.out",
        });
      }
      tl.to(state.element, {
        x: coords.x,
        y: coords.y,
        duration: profile.moveDuration,
        ease: profile.ease,
        onUpdate: () => {
          state.x = gsap.getProperty(state.element, "x") as number;
          state.y = gsap.getProperty(state.element, "y") as number;
        },
      });

      if (gesture === "click") {
        tl.add(() => this.clickRipple(coords.x, coords.y, color));
        tl.to(state.element, { scale: 0.78, duration: 0.06 });
        tl.to(state.element, { scale: 1, duration: 0.1 });
        tl.add(() => coords.element?.classList.add("cursor-clicked"));
        tl.call(() => coords.element?.classList.remove("cursor-clicked"), [], "+=0.2");
      } else {
        tl.add(() => coords.element?.classList.add("cursor-hover"));
        tl.call(() => coords.element?.classList.remove("cursor-hover"), [], "+=0.25");
      }

      state.x = coords.x;
      state.y = coords.y;
    });

    return { hit: true, missingTarget: null };
  }

  private clickRipple(x: number, y: number, color: string): void {
    const ripple = document.createElement("span");
    ripple.className = "click-ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.setProperty("--ripple-color", color);
    this.overlay.appendChild(ripple);
    gsap.fromTo(
      ripple,
      { scale: 0.3, opacity: 0.7 },
      {
        scale: 2.2,
        opacity: 0,
        duration: 0.45,
        onComplete: () => ripple.remove(),
      },
    );
  }

  parkAllOnRail(): void {
    for (const participant of this.participants) {
      this.scheduleTimer(() => this.parkOnRail(participant.id), 0);
    }
  }
}

export function participantsToChoreographyCast(
  participants: Array<{ id: string; name: string; color: string; taskProfile: string }>,
): ChoreographyParticipant[] {
  return participants.map((p) => ({
    ...p,
    motionProfile: PARTICIPANT_PROFILES[p.id] ?? "medium",
  }));
}
