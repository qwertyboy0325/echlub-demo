import { useState } from "react";

interface ControlPoint {
  id: string;
  bar: number;
  value: number;
  selected?: boolean;
}

interface AutomationLane {
  id: string;
  param: string;
  clip: string;
  revision: number;
  range: string;
  points: ControlPoint[];
  curved?: boolean;
}

const LANES: AutomationLane[] = [
  {
    id: "filter-cutoff",
    param: "Filter Cutoff",
    clip: "bass-loop",
    revision: 3,
    range: "20 Hz – 8 kHz",
    curved: true,
    points: [
      { id: "fc1", bar: 1, value: 0.22 },
      { id: "fc2", bar: 3.5, value: 0.55, selected: true },
      { id: "fc3", bar: 6, value: 0.38 },
      { id: "fc4", bar: 8.5, value: 0.72 },
    ],
  },
  {
    id: "delay-wet",
    param: "Delay Wet",
    clip: "shiki-hook",
    revision: 1,
    range: "0 – 100%",
    points: [
      { id: "dw1", bar: 1, value: 0.12 },
      { id: "dw2", bar: 4, value: 0.48 },
      { id: "dw3", bar: 5.5, value: 0.62, selected: true },
      { id: "dw4", bar: 9, value: 0.28 },
      { id: "dw5", bar: 11, value: 0.4 },
    ],
  },
];

const BAR_COUNT = 12;
const PLAYHEAD_BAR = 4.25;

function lanePath(lane: AutomationLane, width: number, height: number): string {
  const x = (bar: number) => ((bar - 1) / (BAR_COUNT - 1)) * width;
  const y = (value: number) => height - value * height;
  const pts = lane.points;
  if (pts.length < 2) return "";

  let d = `M ${x(pts[0]!.bar)} ${y(pts[0]!.value)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const curr = pts[i]!;
    if (lane.curved) {
      const cx = (x(prev.bar) + x(curr.bar)) / 2;
      d += ` C ${cx} ${y(prev.value)}, ${cx} ${y(curr.value)}, ${x(curr.bar)} ${y(curr.value)}`;
    } else {
      d += ` L ${x(curr.bar)} ${y(curr.value)}`;
    }
  }
  return d;
}

export function AutomationEditor() {
  const [selectedId, setSelectedId] = useState("fc2");

  return (
    <div className="automation-editor" aria-label="Fixture automation editor">
      <header className="automation-editor-head">
        <span className="automation-editor-state">Fixture · preview lane</span>
        <span className="automation-editor-playhead tabular-nums">Playhead · bar {PLAYHEAD_BAR.toFixed(1)}</span>
      </header>
      <div className="automation-ruler" aria-hidden>
        <span className="automation-ruler-spacer" />
        <div className="automation-ruler-bars">
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <span key={i} className={`automation-ruler-bar${i % 4 === 0 ? " automation-ruler-bar--downbeat" : ""}`}>
              {i + 1}
            </span>
          ))}
        </div>
      </div>
      <div className="automation-lanes">
        {LANES.map((lane) => {
          const laneWidth = 640;
          const laneHeight = 72;
          const path = lanePath(lane, laneWidth, laneHeight);
          const playheadX = ((PLAYHEAD_BAR - 1) / (BAR_COUNT - 1)) * laneWidth;

          return (
            <div key={lane.id} className="automation-lane-row">
              <div className="automation-lane-meta">
                <strong>{lane.param}</strong>
                <span className="automation-lane-context">
                  {lane.clip} · r{lane.revision}
                </span>
                <span className="automation-lane-range tabular-nums">{lane.range}</span>
              </div>
              <div className="automation-lane-canvas">
                <svg
                  className="automation-lane-svg"
                  viewBox={`0 0 ${laneWidth} ${laneHeight}`}
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  {Array.from({ length: BAR_COUNT }, (_, i) => {
                    const gx = (i / (BAR_COUNT - 1)) * laneWidth;
                    return (
                      <line
                        key={i}
                        x1={gx}
                        y1={0}
                        x2={gx}
                        y2={laneHeight}
                        className={i % 4 === 0 ? "automation-grid-line automation-grid-line--bar" : "automation-grid-line"}
                      />
                    );
                  })}
                  <path d={path} className="automation-curve-path" fill="none" />
                  {lane.points.map((pt) => {
                    const px = ((pt.bar - 1) / (BAR_COUNT - 1)) * laneWidth;
                    const py = laneHeight - pt.value * laneHeight;
                    const active = selectedId === pt.id || pt.selected;
                    return (
                      <circle
                        key={pt.id}
                        cx={px}
                        cy={py}
                        r={active ? 5 : 4}
                        className={`automation-point${active ? " automation-point--selected" : ""}`}
                        onClick={() => setSelectedId(pt.id)}
                      />
                    );
                  })}
                  <line
                    x1={playheadX}
                    y1={0}
                    x2={playheadX}
                    y2={laneHeight}
                    className="automation-playhead"
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
