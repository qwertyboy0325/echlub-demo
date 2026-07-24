#!/usr/bin/env node
/**
 * Generates high-fidelity static HTML frames for EchLub visual directions A/B/C.
 * Run: node design-research/visual/generate-frames.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const FRAMES = join(ROOT, "frames");

const PARTICIPANTS = [
  { id: "p1", name: "Alex", color: "#e76f51", task: "MIDI", tab: "Create" },
  { id: "p2", name: "Jordan", color: "#2a9d8f", task: "Devices", tab: "Devices" },
  { id: "p3", name: "Sam", color: "#e9c46a", task: "Mix", tab: "Mix" },
];

const CLIPS = [
  { title: "pulse-r1", lifecycle: "Available", author: "Alex", color: "#e76f51" },
  { title: "pulse-r2", lifecycle: "In Progress", author: "Jordan", color: "#2a9d8f" },
  { title: "melody-draft", lifecycle: "Review", author: "Sam", color: "#e9c46a" },
  { title: "shiki-hook", lifecycle: "Ready", author: "Alex", color: "#e76f51" },
];

/** @type {Record<string, object>} */
const DIRECTIONS = {
  a: {
    label: "Precision Studio",
    slug: "a",
    font: "'Inter', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    canvas: "#131313",
    panel: "#1a1a1a",
    raised: "#222222",
    separator: "#333333",
    text: "#e6e6e6",
    muted: "#8a8a8a",
    selection: "#3d6a8a",
    focus: "#4a7fa8",
    hover: "#2a2a2a",
    preview: "#5a7a5a",
    recording: "#a84848",
    ready: "#6a8a5a",
    master: "#7a6a4a",
    activeShared: "#4a7fa8",
    radius: "2px",
    radiusControl: "3px",
    shadow: "none",
    controlKnob: "#2e2e2e",
    controlKnobRing: "#555555",
    faderTrack: "#1e1e1e",
    faderFill: "#5a7a8a",
    meter: "#4a8a5a",
    chipBg: "#252525",
    gridLine: "#2a2a2a",
    accentNote: "flat graphite, 1px rules, semantic color only",
  },
  b: {
    label: "Modern Hardware Console",
    slug: "b",
    font: "'Inter', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    canvas: "#181614",
    panel: "#211e1c",
    raised: "#2a2623",
    separator: "#3d3834",
    text: "#ece8e4",
    muted: "#9a928a",
    selection: "#c4956a",
    focus: "#d4a574",
    hover: "#322e2a",
    preview: "#6a9a7a",
    recording: "#c45a4a",
    ready: "#8aaa6a",
    master: "#c4956a",
    activeShared: "#d4a574",
    radius: "4px",
    radiusControl: "6px",
    shadow: "0 1px 0 rgba(0,0,0,0.4)",
    controlKnob: "#3a3530",
    controlKnobRing: "#6a6058",
    faderTrack: "#141210",
    faderFill: "#8a7a5a",
    meter: "#6aaa5a",
    chipBg: "#2e2a26",
    gridLine: "#35302c",
    accentNote: "warm neutrals, tactile controls, no skeuomorphism",
  },
  c: {
    label: "Editorial Broadcast Studio",
    slug: "c",
    font: "'Source Sans 3', 'Inter', system-ui, sans-serif",
    mono: "'Source Code Pro', ui-monospace, monospace",
    canvas: "#0e0e0e",
    panel: "#161616",
    raised: "#1c1c1c",
    separator: "#2e2e2e",
    text: "#f2f2f2",
    muted: "#9a9a9a",
    selection: "#d44d2a",
    focus: "#e85a34",
    hover: "#242424",
    preview: "#4a7a6a",
    recording: "#d44d2a",
    ready: "#5a8a6a",
    master: "#c4a035",
    activeShared: "#e85a34",
    radius: "0px",
    radiusControl: "2px",
    shadow: "none",
    controlKnob: "#242424",
    controlKnobRing: "#505050",
    faderTrack: "#121212",
    faderFill: "#888888",
    meter: "#d44d2a",
    chipBg: "#1a1a1a",
    gridLine: "#282828",
    accentNote: "editorial grid, broadcast typography, presentation legibility",
  },
};

function css(d) {
  return `:root {
  --canvas: ${d.canvas};
  --panel: ${d.panel};
  --raised: ${d.raised};
  --separator: ${d.separator};
  --text: ${d.text};
  --muted: ${d.muted};
  --selection: ${d.selection};
  --focus: ${d.focus};
  --hover: ${d.hover};
  --preview: ${d.preview};
  --recording: ${d.recording};
  --ready: ${d.ready};
  --master: ${d.master};
  --active-shared: ${d.activeShared};
  --radius: ${d.radius};
  --radius-control: ${d.radiusControl};
  --shadow: ${d.shadow};
  --font: ${d.font};
  --mono: ${d.mono};
  --knob: ${d.controlKnob};
  --knob-ring: ${d.controlKnobRing};
  --fader-track: ${d.faderTrack};
  --fader-fill: ${d.faderFill};
  --meter: ${d.meter};
  --chip-bg: ${d.chipBg};
  --grid-line: ${d.gridLine};
}
* { box-sizing: border-box; margin: 0; }
body { font-family: var(--font); background: var(--canvas); color: var(--text); overflow: hidden; }
.shell { display: flex; flex-direction: column; height: 100%; }
.top { height: 48px; background: var(--panel); border-bottom: 1px solid var(--separator); display: flex; align-items: center; padding: 0 16px; gap: 12px; font-size: 13px; }
.top .brand { font-weight: 600; letter-spacing: -0.02em; }
.top .room { color: var(--muted); font-size: 12px; }
.top .chip { background: var(--chip-bg); border: 1px solid var(--separator); padding: 3px 8px; font-size: 11px; border-radius: var(--radius); }
.top .chip.on { border-color: var(--focus); color: var(--focus); }
.body { display: flex; flex: 1; min-height: 0; }
.presence { width: 200px; background: var(--panel); border-right: 1px solid var(--separator); padding: 12px; flex-shrink: 0; }
.presence h3, .exchange h3, .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 10px; font-weight: 600; }
.person { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; padding: 6px 8px; border-radius: var(--radius); border: 1px solid transparent; }
.person.active { background: var(--raised); border-color: var(--separator); }
.avatar { width: 24px; height: 24px; border-radius: ${d.slug === "c" ? "2px" : "50%"}; flex-shrink: 0; }
.person-meta { font-size: 11px; line-height: 1.3; }
.person-meta .sub { color: var(--muted); font-size: 10px; }
.center { flex: 1; display: flex; flex-direction: column; padding: 10px; gap: 8px; min-width: 0; }
.panel { background: var(--panel); border: 1px solid var(--separator); border-radius: var(--radius); box-shadow: var(--shadow); }
.exchange { width: 320px; background: var(--panel); border-left: 1px solid var(--separator); padding: 12px; flex-shrink: 0; overflow: auto; }
.exchange.compact { display: none; }
.row { background: var(--raised); border: 1px solid var(--separator); padding: 8px 10px; margin-bottom: 6px; border-radius: var(--radius); font-size: 11px; }
.row .lifecycle { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 4px; }
.row .title { font-weight: 500; }
.wave { height: 18px; margin-top: 6px; background: repeating-linear-gradient(90deg, var(--separator) 0 1px, transparent 1px 5px); opacity: 0.7; }
.transport { height: 48px; background: var(--panel); border-top: 1px solid var(--separator); display: flex; align-items: center; padding: 0 16px; gap: 16px; font-size: 12px; font-family: var(--mono); }
.btn { background: var(--raised); border: 1px solid var(--separator); color: var(--text); padding: 4px 10px; font-size: 11px; border-radius: var(--radius); cursor: default; }
.btn.primary { border-color: var(--focus); color: var(--focus); }
.btn.stage { border-color: var(--selection); }
.lane { height: 44px; background: var(--raised); border: 1px solid var(--separator); margin-bottom: 6px; display: flex; align-items: center; padding: 0 12px; font-size: 11px; color: var(--muted); border-radius: var(--radius); }
.lane.staged { border-color: var(--selection); color: var(--text); }
.lane.active { border-color: var(--active-shared); background: color-mix(in srgb, var(--active-shared) 8%, var(--raised)); }
.master-strip { height: 56px; display: flex; align-items: center; gap: 12px; padding: 8px 12px; }
.meter-bar { flex: 1; height: 20px; background: var(--fader-track); border: 1px solid var(--separator); position: relative; overflow: hidden; }
.meter-fill { height: 100%; background: var(--meter); width: 62%; }
.tabs { display: flex; gap: 0; border-bottom: 1px solid var(--separator); margin-bottom: 8px; }
.tab { padding: 8px 14px; font-size: 11px; color: var(--muted); border-bottom: 2px solid transparent; }
.tab.active { color: var(--text); border-bottom-color: var(--focus); font-weight: 600; }
.editor { flex: 1; min-height: 0; position: relative; }
.piano-grid { position: absolute; inset: 0; background-image: linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px); background-size: 24px 20px; }
.note { position: absolute; height: 18px; background: color-mix(in srgb, var(--selection) 60%, transparent); border: 1px solid var(--selection); border-radius: var(--radius); }
.playhead { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--recording); left: 38%; }
.slot-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; height: 100%; }
.slot { background: var(--raised); border: 1px solid var(--separator); border-radius: var(--radius-control); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 8px; min-height: 100px; }
.slot.master-slot { border-color: var(--master); }
.slot.snap-target { border-color: var(--focus); border-style: dashed; }
.knob { width: ${d.slug === "b" ? "64px" : "48px"}; height: ${d.slug === "b" ? "64px" : "48px"}; border-radius: 50%; background: var(--knob); border: 2px solid var(--knob-ring); position: relative; }
.knob::after { content: ''; position: absolute; top: 6px; left: 50%; width: 2px; height: ${d.slug === "b" ? "12px" : "10px"}; background: var(--text); transform: translateX(-50%); }
.fader { width: ${d.slug === "b" ? "12px" : "8px"}; height: ${d.slug === "b" ? "90px" : "72px"}; background: var(--fader-track); border: 1px solid var(--separator); position: relative; border-radius: var(--radius-control); }
.fader-fill { position: absolute; bottom: 0; left: 0; right: 0; height: 55%; background: var(--fader-fill); }
.toggle { width: 36px; height: 20px; background: var(--preview); border: 1px solid var(--separator); border-radius: ${d.slug === "a" ? "2px" : "10px"}; }
.trigger { width: 44px; height: 44px; background: var(--raised); border: 1px solid var(--separator); border-radius: var(--radius-control); }
.badge { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 5px; border: 1px solid var(--separator); border-radius: var(--radius); color: var(--muted); }
.badge.preview { color: var(--preview); border-color: var(--preview); }
.badge.capture { color: var(--recording); border-color: var(--recording); }
.badge.master { color: var(--master); border-color: var(--master); }
.lifecycle-available { color: var(--muted); }
.lifecycle-progress { color: var(--focus); }
.lifecycle-review { color: var(--recording); }
.lifecycle-ready { color: var(--ready); }
.cursor { position: absolute; pointer-events: none; z-index: 10; }
.cursor-label { font-size: 10px; padding: 2px 6px; white-space: nowrap; }
.cursor-dot { width: 8px; height: 8px; border: 1px solid #fff; }
.chain { display: flex; align-items: center; gap: 8px; padding: 16px; }
.device { background: var(--raised); border: 1px solid var(--separator); padding: 12px 16px; font-size: 11px; border-radius: var(--radius-control); min-width: 80px; text-align: center; }
.chain-arrow { color: var(--muted); font-size: 14px; }
.header-ctx { font-size: 11px; color: var(--muted); padding: 8px 12px; border-bottom: 1px solid var(--separator); display: flex; gap: 16px; }
.header-ctx strong { color: var(--text); }
.compact .presence { width: 48px; padding: 8px 4px; }
.compact .presence h3, .compact .person-meta { display: none; }
.compact .person { justify-content: center; padding: 4px; }
.frame-label { position: fixed; bottom: 4px; right: 8px; font-size: 9px; color: var(--muted); font-family: var(--mono); opacity: 0.6; z-index: 99; }
`;
}

function wrap(title, d, w, h, body, extraClass = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=${w}, height=${h}"/>
<title>EchLub ${d.label} — ${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Source+Code+Pro:wght@400;500&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
${css(d)}
body { width: ${w}px; height: ${h}px; }
${extraClass.includes("compact") ? `.exchange { display: none; } .exchange-drawer-btn { display: block; }` : `.exchange-drawer-btn { display: none; }`}
</style>
</head>
<body class="${extraClass}">
${body}
<div class="frame-label">${d.label} · ${title} · ${w}×${h}</div>
</body>
</html>`;
}

function topBar(d, room, extras = "") {
  return `<div class="top">
  <span class="brand">EchLub</span>
  <span class="room">${room}</span>
  <span class="chip">Follow ○</span>
  ${extras}
  <span style="flex:1"></span>
  <span class="chip">▶ 1.1.1</span>
  <span class="chip">Bleed Low</span>
</div>`;
}

function presenceRail(activeIdx = 0) {
  return `<aside class="presence">
  <h3>Presence</h3>
  ${PARTICIPANTS.map((p, i) => `<div class="person${i === activeIdx ? " active" : ""}">
    <div class="avatar" style="background:${p.color}"></div>
    <div class="person-meta"><div>${p.name}</div><div class="sub">${p.task} · ${i === activeIdx ? "active" : "idle"}</div></div>
  </div>`).join("\n  ")}
</aside>`;
}

function exchangeRail(expanded = false) {
  const rows = CLIPS.map((c) => {
    const lc = c.lifecycle.replace(" ", "-").toLowerCase();
    return `<div class="row" style="border-left: 3px solid ${c.color}">
      <div class="lifecycle lifecycle-${lc === "in-progress" ? "progress" : lc}">${c.lifecycle}</div>
      <div class="title">${c.title}</div>
      <div class="sub" style="color:var(--muted);font-size:10px;margin-top:2px">${c.author}</div>
      <div class="wave"></div>
      ${expanded && c.title === "pulse-r2" ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--separator);font-size:10px;color:var(--muted)">Fork of pulse-r1 · rev 2 · Jordan · Devices chain attached</div>` : ""}
    </div>`;
  }).join("\n  ");
  return `<aside class="exchange"><h3>Shared Clip Exchange</h3>${rows}</aside>`;
}

function globalBody(d, w, compact = false) {
  return `<div class="shell">
${topBar(d, "Global Studio", `<span class="chip stage">Stage</span><span class="btn primary">Activate</span>`)}
<div class="body">
${compact ? presenceRail(1).replace('class="presence"', 'class="presence"') : presenceRail(1)}
<main class="center">
  <div class="panel editor" style="flex:1;padding:12px">
    <div class="section-label">Arrangement</div>
    <div class="lane">Lane 1 — empty · drag from Exchange to stage</div>
    <div class="lane staged">pulse-r2 · staged · Jordan</div>
    <div class="lane active">shiki-hook · active · Alex</div>
  </div>
  <div class="panel master-strip">
    <span style="font-size:10px;width:72px;color:var(--muted)">Shared Master</span>
    <div class="meter-bar"><div class="meter-fill"></div></div>
  </div>
  <div class="panel" style="padding:8px 12px;font-size:11px;color:var(--muted)">Jordan forked pulse-r2 · melody-draft in Review · Sam on Mix</div>
</main>
${compact ? "" : exchangeRail()}
</div>
<div class="transport">
  <button class="btn">▶</button>
  <span>1.1.1</span>
  <span style="color:var(--muted)">120 BPM</span>
  <span style="margin-left:auto;color:var(--muted);font-size:10px">Stage/Activate — Global only</span>
</div>
</div>`;
}

function participantCreate(d) {
  return `<div class="shell">
${topBar(d, "Participant · Alex · Create")}
<div class="body">
${presenceRail(0)}
<main class="center">
  <div class="header-ctx"><span>Clip <strong>pulse-r1</strong></span><span>rev 1</span><span>Alex</span><span>source: step seq</span></div>
  <div class="tabs">
    <span class="tab active">Create</span><span class="tab">Devices</span><span class="tab">Automation</span><span class="tab">Mix</span><span class="tab">Queue</span>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:8px;font-size:10px">
    <span class="chip on">Piano Roll</span><span class="chip">Step</span><span class="chip">Clip editor</span>
  </div>
  <div class="panel editor" style="flex:1;min-height:400px">
    <div class="piano-grid"></div>
    <div class="note" style="left:12%;width:8%"></div>
    <div class="note" style="left:22%;width:12%"></div>
    <div class="note" style="left:40%;width:6%"></div>
    <div class="playhead"></div>
  </div>
</main>
${exchangeRail()}
</div>
<div class="transport"><button class="btn">▶</button><span>1.1.1</span><span style="color:var(--muted);font-size:10px">No Stage/Activate</span></div>
</div>`;
}

function participantDevices(d) {
  return `<div class="shell">
${topBar(d, "Participant · Jordan · Devices")}
<div class="body">
${presenceRail(1)}
<main class="center">
  <div class="header-ctx"><span>Clip <strong>pulse-r2</strong></span><span>rev 2</span><span>Jordan</span></div>
  <div class="tabs"><span class="tab">Create</span><span class="tab active">Devices</span><span class="tab">Automation</span><span class="tab">Mix</span><span class="tab">Queue</span></div>
  <div class="panel editor" style="flex:1;padding:24px">
    <div class="section-label">Signal chain</div>
    <div class="chain">
      <div class="device">Operator<br/><span style="color:var(--muted);font-size:9px">Synth</span></div>
      <span class="chain-arrow">→</span>
      <div class="device" style="border-color:var(--focus)">Filter<br/><span style="color:var(--muted);font-size:9px">LP 24dB</span></div>
      <span class="chain-arrow">→</span>
      <div class="device">Delay<br/><span style="color:var(--muted);font-size:9px">1/8 dotted</span></div>
      <span class="chain-arrow">→</span>
      <div class="device">Output<br/><span style="color:var(--muted);font-size:9px">Preview</span></div>
    </div>
  </div>
</main>
${exchangeRail()}
</div>
<div class="transport"><button class="btn">▶</button><span>Preview</span></div>
</div>`;
}

function mixer(d) {
  return `<div class="shell">
${topBar(d, "Mixer · Sam · Performance", `<span class="chip on">LIVE</span>`)}
<div class="body">
${presenceRail(2)}
<main class="center">
  <div class="panel" style="height:38%;display:flex;gap:8px;padding:12px;align-items:flex-end">
    ${["Kick", "Bass", "Lead", "FX", "Vox"].map((n) => `<div style="width:${d.slug === "b" ? "72" : "56"}px;height:100%;background:var(--raised);border:1px solid var(--separator);border-radius:var(--radius-control);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:8px;gap:4px">
      <div style="width:4px;height:40%;background:var(--meter)"></div>
      <div class="fader"><div class="fader-fill"></div></div>
      <span style="font-size:9px;color:var(--muted)">${n}</span>
    </div>`).join("")}
  </div>
  <div class="panel" style="flex:1;padding:12px">
    <div class="section-label">Live Control Dock · 8 slots</div>
    <div class="slot-grid" style="margin-top:8px;height:calc(100% - 24px)">
      <div class="slot master-slot"><div class="knob"></div><span style="font-size:10px">Filter</span><span class="badge master">MASTER</span></div>
      <div class="slot"><div class="knob"></div><span style="font-size:10px">Delay</span><span class="badge preview">PREVIEW</span></div>
      <div class="slot"><div class="fader"><div class="fader-fill"></div></div><span style="font-size:10px">Reverb</span></div>
      <div class="slot"><div class="fader"><div class="fader-fill" style="height:30%"></div></div><span style="font-size:10px">Level</span></div>
      <div class="slot"><div class="toggle"></div><span style="font-size:10px">Mute</span></div>
      <div class="slot"><div class="trigger"></div><span style="font-size:10px">Trigger</span><span class="badge capture">CAPTURE</span></div>
      <div class="slot snap-target" style="border-style:dashed;opacity:0.8"><span style="font-size:10px;color:var(--muted)">Drop param</span></div>
      <div class="slot" style="border-style:dashed;opacity:0.5"><span style="font-size:10px;color:var(--muted)">Empty</span></div>
    </div>
  </div>
</main>
${exchangeRail()}
</div>
</div>`;
}

function queueStates(d) {
  const chips = CLIPS.map((c) => {
    const lc = c.lifecycle.replace(" ", "-").toLowerCase();
    return `<div class="row"><div class="lifecycle lifecycle-${lc === "in-progress" ? "progress" : lc}">${c.lifecycle}</div><div class="title">${c.title}</div><div class="wave"></div></div>`;
  }).join("");
  return `<div class="shell"><div class="top"><span class="brand">EchLub</span><span class="room">Queue states</span></div>
<div class="body" style="padding:24px"><div style="max-width:480px">${chips}</div></div></div>`;
}

function midiDetail(d) {
  return `<div class="shell"><div class="top"><span class="brand">EchLub</span><span class="room">MIDI · velocity · playhead</span></div>
<div class="body" style="padding:16px"><div class="panel editor" style="width:100%;height:calc(100% - 32px);position:relative">
<div class="piano-grid"></div>
<div class="note" style="left:8%;width:10%;opacity:0.4;height:14px;top:20%"></div>
<div class="note" style="left:8%;width:10%;height:22px;top:20%"></div>
<div class="note" style="left:25%;width:14%;height:18px;top:35%"></div>
<div class="note" style="left:45%;width:8%;height:12px;top:50%;opacity:0.6"></div>
<div class="playhead"></div>
<div style="position:absolute;bottom:8px;left:12px;font-size:10px;color:var(--muted);font-family:var(--mono)">vel 96 · C4 · bar 3.2</div>
</div></div></div>`;
}

function controlsPrimitives(d) {
  return `<div class="shell"><div class="top"><span class="brand">EchLub</span><span class="room">Control primitives</span></div>
<div class="body" style="padding:24px;display:flex;gap:32px;align-items:center;justify-content:center;flex-wrap:wrap">
<div style="text-align:center"><div class="knob"></div><div style="font-size:10px;margin-top:8px;color:var(--muted)">Knob</div></div>
<div style="text-align:center"><div class="fader"><div class="fader-fill"></div></div><div style="font-size:10px;margin-top:8px;color:var(--muted)">Fader</div></div>
<div style="text-align:center"><div class="toggle"></div><div style="font-size:10px;margin-top:8px;color:var(--muted)">Toggle</div></div>
<div style="text-align:center"><div class="trigger"></div><div style="font-size:10px;margin-top:8px;color:var(--muted)">Trigger</div></div>
<div style="text-align:center;width:120px"><div class="meter-bar" style="height:80px;width:24px"><div class="meter-fill" style="width:100%;height:70%"></div></div><div style="font-size:10px;margin-top:8px;color:var(--muted)">Meter</div></div>
</div></div>`;
}

function cursorFollow(d) {
  return `<div class="shell">${topBar(d, "Follow · cursor · selection")}
<div class="body">${presenceRail(0)}
<main class="center"><div class="panel editor" style="flex:1;position:relative">
<div class="piano-grid"></div>
<div class="note" style="left:30%;width:12%;border:2px solid var(--focus)"></div>
<div class="cursor" style="left:42%;top:35%"><div class="cursor-label" style="background:#e76f51;color:#111">Alex</div><div class="cursor-dot" style="background:#e76f51"></div></div>
<div class="cursor" style="left:55%;top:60%"><div class="cursor-label" style="background:#2a9d8f;color:#111">Jordan</div><div class="cursor-dot" style="background:#2a9d8f"></div></div>
</div></main>${exchangeRail()}
</div><div class="transport"><span class="chip on">Follow locked</span><button class="btn">Resume Follow</button></div></div>`;
}

function previewMaster(d) {
  return `<div class="shell"><div class="top"><span class="brand">EchLub</span><span class="room">Preview vs Shared Master</span></div>
<div class="body" style="padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
<div class="panel" style="padding:16px"><div class="section-label">Local preview</div><div class="meter-bar" style="margin:12px 0"><div class="meter-fill" style="width:45%;background:var(--preview)"></div></div><span class="badge preview">PREVIEW</span><p style="font-size:11px;color:var(--muted);margin-top:12px">Jordan · pulse-r2 · Devices chain</p></div>
<div class="panel" style="padding:16px;border-color:var(--master)"><div class="section-label">Shared Master</div><div class="meter-bar" style="margin:12px 0"><div class="meter-fill" style="width:78%"></div></div><span class="badge master">MASTER</span><p style="font-size:11px;color:var(--muted);margin-top:12px">Arrangement output · shiki-hook active</p></div>
</div></div>`;
}

function dragSnap(d) {
  return `<div class="shell"><div class="top"><span class="brand">EchLub</span><span class="room">Drag · snap · stage</span></div>
<div class="body" style="padding:24px">
<div class="panel" style="padding:16px;margin-bottom:16px"><div class="section-label">Exchange → Arrangement</div>
<div class="row" style="opacity:0.6;border-style:dashed;width:200px">melody-draft (dragging…)</div>
<div class="lane" style="border-color:var(--focus);border-style:dashed;margin-top:12px">Lane 2 — snap target</div></div>
<div class="panel" style="padding:16px"><div class="section-label">Param → Dock slot</div>
<div class="slot-grid" style="height:120px"><div class="slot snap-target"><span style="font-size:10px">Snap here</span></div><div class="slot"><div class="knob"></div></div></div></div>
</div></div>`;
}

function exchangeExpanded(d) {
  return `<div class="shell">${topBar(d, "Exchange row + artifact")}
<div class="body" style="padding:24px"><div style="max-width:360px">${exchangeRail(true).replace('<aside class="exchange">', '<div>').replace("</aside>", "</div>")}</div></div></div>`;
}

function liveDock(d) {
  return mixer(d).replace(/<div class="panel" style="height:38%[^]*?<\/div>\s*<div class="panel"/s, '<div class="panel"');
}

const FRAME_DEFS = [
  { id: "01-global-studio-1440", title: "Global Studio", w: 1440, h: 900, fn: (d) => globalBody(d, 1440) },
  { id: "02-participant-create-1440", title: "Participant Create", w: 1440, h: 900, fn: (d) => participantCreate(d) },
  { id: "03-participant-devices-1440", title: "Participant Devices", w: 1440, h: 900, fn: (d) => participantDevices(d) },
  { id: "04-mixer-performance-1440", title: "Mixer Performance", w: 1440, h: 900, fn: (d) => mixer(d) },
  { id: "05-global-exchange-collapsed-1280", title: "Global collapsed Exchange", w: 1280, h: 720, fn: (d) => globalBody(d, 1280, true), cls: "compact" },
  { id: "06-exchange-row-expanded", title: "Exchange row expanded", w: 1440, h: 900, fn: (d) => exchangeExpanded(d) },
  { id: "07-queue-states", title: "Queue states", w: 1280, h: 720, fn: (d) => queueStates(d) },
  { id: "08-midi-note-velocity-playhead", title: "MIDI note velocity playhead", w: 1280, h: 720, fn: (d) => midiDetail(d) },
  { id: "09-devices-chain", title: "Devices chain", w: 1280, h: 720, fn: (d) => participantDevices(d) },
  { id: "10-live-control-dock-8-slots", title: "Live Control Dock", w: 1440, h: 900, fn: (d) => liveDock(d) },
  { id: "11-control-primitives", title: "Control primitives", w: 1280, h: 720, fn: (d) => controlsPrimitives(d) },
  { id: "12-cursor-follow-selection", title: "Cursor follow selection", w: 1440, h: 900, fn: (d) => cursorFollow(d) },
  { id: "13-preview-vs-shared-master", title: "Preview vs Shared Master", w: 1280, h: 720, fn: (d) => previewMaster(d) },
  { id: "14-drag-snap-states", title: "Drag snap states", w: 1280, h: 720, fn: (d) => dragSnap(d) },
];

function contactSheet(d, slug) {
  const items = FRAME_DEFS.map((f) => {
    const href = `${f.id}.html`;
    return `<a class="thumb" href="${href}" target="_blank"><iframe src="${href}" scrolling="no"></iframe><span>${f.title}</span></a>`;
  }).join("\n");
  return wrap(
    "Contact sheet",
    d,
    1440,
    900,
    `<div style="padding:16px;height:100%;overflow:auto">
<h1 style="font-size:18px;font-weight:600;margin-bottom:4px">${d.label}</h1>
<p style="font-size:12px;color:var(--muted);margin-bottom:16px">${d.accentNote}</p>
<div class="grid">${items}</div>
<style>
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.thumb { display: block; background: var(--panel); border: 1px solid var(--separator); padding: 8px; text-decoration: none; color: var(--text); border-radius: var(--radius); }
.thumb iframe { width: 100%; height: 140px; border: none; pointer-events: none; transform: scale(0.25); transform-origin: 0 0; width: 400%; height: 400%; margin-bottom: -420px; }
.thumb span { font-size: 10px; display: block; margin-top: 4px; color: var(--muted); }
</style>
</div>`,
  );
}

function combinedContactSheet() {
  const dirs = Object.values(DIRECTIONS);
  const rows = FRAME_DEFS.map((f) => {
    const cells = dirs
      .map(
        (d) =>
          `<td><a href="frames/${d.slug}/${f.id}.html" target="_blank">${d.label}<br/><span style="font-size:9px;color:#888">${f.title}</span></a></td>`,
      )
      .join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>EchLub A/B/C Comparison</title>
<style>
body { font-family: Inter, system-ui, sans-serif; background: #0a0a0a; color: #eee; padding: 24px; }
table { border-collapse: collapse; width: 100%; font-size: 12px; }
th, td { border: 1px solid #333; padding: 10px; text-align: left; vertical-align: top; }
th { background: #161616; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
a { color: #ccc; text-decoration: none; }
a:hover { color: #fff; }
h1 { font-size: 20px; margin-bottom: 8px; }
p { color: #888; font-size: 13px; margin-bottom: 20px; }
</style></head><body>
<h1>EchLub Visual Directions — A / B / C Comparison</h1>
<p>Same Three Rooms / Focus Shell IA · click any cell to open frame</p>
<table>
<thead><tr><th>Frame</th><th>A Precision Studio</th><th>B Hardware Console</th><th>C Editorial Broadcast</th></tr></thead>
<tbody>
${FRAME_DEFS.map((f) => `<tr><td>${f.title}</td>${dirs.map((d) => `<td><a href="frames/${d.slug}/${f.id}.html">${f.id}</a></td>`).join("")}</tr>`).join("\n")}
</tbody></table>
</body></html>`;
}

mkdirSync(join(FRAMES, "a"), { recursive: true });
mkdirSync(join(FRAMES, "b"), { recursive: true });
mkdirSync(join(FRAMES, "c"), { recursive: true });
mkdirSync(join(ROOT, "tokens"), { recursive: true });

for (const [key, d] of Object.entries(DIRECTIONS)) {
  writeFileSync(join(ROOT, "tokens", `direction-${key}.css`), css(d));
  for (const f of FRAME_DEFS) {
    const html = wrap(f.title, d, f.w, f.h, f.fn(d), f.cls || "");
    writeFileSync(join(FRAMES, d.slug, `${f.id}.html`), html);
  }
  writeFileSync(join(FRAMES, d.slug, "contact-sheet.html"), contactSheet(d, d.slug));
}

writeFileSync(join(FRAMES, "comparison-contact-sheet.html"), combinedContactSheet());
console.log("Generated", FRAME_DEFS.length * 3, "frames + contact sheets");
