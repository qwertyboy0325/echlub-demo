const active = new Set<ReturnType<typeof setTimeout>>();

export function registerTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const id = setTimeout(() => {
    active.delete(id);
    fn();
  }, ms);
  active.add(id);
  return id;
}

export function cancelTimeout(id: ReturnType<typeof setTimeout> | null): void {
  if (id === null) return;
  clearTimeout(id);
  active.delete(id);
}

export function clearAllTimeouts(): void {
  active.forEach((id) => clearTimeout(id));
  active.clear();
}

export function activeTimeoutCount(): number {
  return active.size;
}
