export interface MusicalPosition {
  bar: number;
  beat: number;
  sixteenth: number;
}

export function parsePosition(at: string): MusicalPosition {
  const [bar, beat, sixteenth] = at.split(":").map(Number);
  return {
    bar: Number.isFinite(bar) ? bar : 0,
    beat: Number.isFinite(beat) ? beat : 0,
    sixteenth: Number.isFinite(sixteenth) ? Math.floor(sixteenth) : 0,
  };
}

export function positionToTicks(p: MusicalPosition): number {
  return p.bar * 16 + p.beat * 4 + p.sixteenth;
}

export function formatPosition(p: MusicalPosition): string {
  return `${p.bar}:${p.beat}:${p.sixteenth}`;
}

export function positionFromBarBeat(bar: number, beat = 0, sixteenth = 0): MusicalPosition {
  return { bar, beat, sixteenth };
}

export function addMeasures(p: MusicalPosition, measures: number): MusicalPosition {
  return { ...p, bar: p.bar + measures };
}

export function addSixteenths(p: MusicalPosition, sixteenths: number): MusicalPosition {
  const total = positionToTicks(p) + sixteenths;
  return {
    bar: Math.floor(total / 16),
    beat: Math.floor((total % 16) / 4),
    sixteenth: total % 4,
  };
}

export function parseTransportPosition(raw: string): MusicalPosition {
  return parsePosition(raw);
}
