import type { RoomId, ShellState } from "../../shell/domain/shellTypes";
import { v3SelectorForKey, type V3UiTargetKey } from "./v3UiTargets";

export type TargetFailureReason = "missing" | "hidden" | "disabled" | "off-viewport";

export interface V3TargetFailure {
  key: V3UiTargetKey;
  selector: string;
  reason: TargetFailureReason;
  beatId: string;
  participantId: string;
  room: RoomId;
  exchangeOpen: boolean;
  participantTab: string;
}

export interface V3TargetResolution {
  key: V3UiTargetKey;
  selector: string;
  element: HTMLElement;
  interactable: HTMLElement;
}

const V3_ROOT_SELECTOR = '[data-presentation="v3"]';

export function v3PresentationRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>(V3_ROOT_SELECTOR);
}

function isVisible(el: HTMLElement): boolean {
  if (el.classList.contains("sr-only")) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return rect.bottom > 0 && rect.right > 0 && rect.left < vw && rect.top < vh;
}

function isEnabled(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  return !el.closest("[aria-disabled='true'], :disabled");
}

function resolveInteractable(element: HTMLElement): HTMLElement {
  if (element.matches("input, button, [role='button'], [role='tab'], [role='slider']")) return element;
  const inner = element.querySelector<HTMLElement>(
    "button, input, [role='button'], [role='tab'], [role='slider'], .dock-knob",
  );
  return inner ?? element;
}

export function resolveV3Target(
  key: V3UiTargetKey,
  context: {
    beatId: string;
    participantId: string;
    state: ShellState;
  },
  root: ParentNode = v3PresentationRoot() ?? document,
): V3TargetResolution | V3TargetFailure {
  const selector = v3SelectorForKey(key);
  const element = root.querySelector<HTMLElement>(selector);
  const room = context.state.room;
  const failureBase = {
    key,
    selector,
    beatId: context.beatId,
    participantId: context.participantId,
    room,
    exchangeOpen: context.state.exchangeOpen,
    participantTab: context.state.participantTab,
  };

  if (!element) {
    return { ...failureBase, reason: "missing" };
  }
  if (!isVisible(element)) {
    return { ...failureBase, reason: "hidden" };
  }
  const interactable = resolveInteractable(element);
  if (!isEnabled(interactable)) {
    return { ...failureBase, reason: "disabled" };
  }
  if (!isInViewport(interactable)) {
    return { ...failureBase, reason: "off-viewport" };
  }
  return { key, selector, element, interactable };
}
