import fs from "node:fs";
import path from "node:path";

const inputPath = path.resolve(process.argv[2] ?? "");
if (!inputPath || !fs.existsSync(inputPath)) {
  throw new Error("Usage: node scripts/analyze-midi-authority.mjs /absolute/path/to/file.mid");
}

const data = fs.readFileSync(inputPath);
let cursor = 0;

const readU16 = () => {
  const value = data.readUInt16BE(cursor);
  cursor += 2;
  return value;
};

const readU32 = () => {
  const value = data.readUInt32BE(cursor);
  cursor += 4;
  return value;
};

const readChunk = () => {
  const id = data.toString("ascii", cursor, cursor + 4);
  cursor += 4;
  const length = readU32();
  const start = cursor;
  cursor += length;
  return { id, start, end: cursor, length };
};

const header = readChunk();
if (header.id !== "MThd" || header.length !== 6) {
  throw new Error("Not a standard MIDI file");
}

cursor = header.start;
const format = readU16();
const trackCount = readU16();
const division = readU16();
if ((division & 0x8000) !== 0) {
  throw new Error("SMPTE time division is not supported");
}
const ticksPerQuarter = division;
cursor = header.end;

const readVlq = (state) => {
  let value = 0;
  let byte = 0;
  do {
    byte = data[state.offset++];
    value = (value << 7) | (byte & 0x7f);
  } while ((byte & 0x80) !== 0);
  return value;
};

const textDecoder = new TextDecoder("latin1");
const textFrom = (start, length) => textDecoder.decode(data.subarray(start, start + length)).replace(/\0+$/u, "");
const metaTextTypes = new Map([
  [0x01, "text"],
  [0x02, "copyright"],
  [0x03, "trackName"],
  [0x04, "instrumentName"],
  [0x05, "lyric"],
  [0x06, "marker"],
  [0x07, "cue"],
]);

const tracks = [];
const tempos = [];
const timeSignatures = [];
const keySignatures = [];
const markers = [];

for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
  const chunk = readChunk();
  if (chunk.id !== "MTrk") throw new Error(`Expected MTrk, received ${chunk.id}`);

  const state = { offset: chunk.start };
  let tick = 0;
  let runningStatus = null;
  let name = `Track ${trackIndex + 1}`;
  const events = [];
  const activeNotes = new Map();
  const notes = [];
  const programs = [];

  while (state.offset < chunk.end) {
    tick += readVlq(state);
    let status = data[state.offset++];
    if (status < 0x80) {
      if (runningStatus === null) throw new Error(`Running status without status byte in track ${trackIndex}`);
      state.offset -= 1;
      status = runningStatus;
    } else if (status < 0xf0) {
      runningStatus = status;
    }

    if (status === 0xff) {
      const type = data[state.offset++];
      const length = readVlq(state);
      const start = state.offset;
      state.offset += length;
      const label = metaTextTypes.get(type);
      if (label) {
        const text = textFrom(start, length);
        events.push({ tick, type: label, text });
        if (type === 0x03 && text) name = text;
        if (type === 0x06 || type === 0x07) markers.push({ tick, type: label, text, trackIndex });
      } else if (type === 0x51 && length === 3) {
        const microsecondsPerQuarter =
          (data[start] << 16) | (data[start + 1] << 8) | data[start + 2];
        const tempo = { tick, bpm: 60_000_000 / microsecondsPerQuarter, microsecondsPerQuarter, trackIndex };
        tempos.push(tempo);
        events.push({ tick, type: "tempo", bpm: tempo.bpm });
      } else if (type === 0x58 && length >= 4) {
        const signature = {
          tick,
          numerator: data[start],
          denominator: 2 ** data[start + 1],
          clocksPerClick: data[start + 2],
          thirtySecondsPerQuarter: data[start + 3],
          trackIndex,
        };
        timeSignatures.push(signature);
        events.push({ tick, type: "timeSignature", numerator: signature.numerator, denominator: signature.denominator });
      } else if (type === 0x59 && length >= 2) {
        const sharpsFlats = data.readInt8(start);
        const signature = { tick, sharpsFlats, mode: data[start + 1] === 1 ? "minor" : "major", trackIndex };
        keySignatures.push(signature);
        events.push({ tick, type: "keySignature", sharpsFlats, mode: signature.mode });
      } else if (type === 0x2f) {
        events.push({ tick, type: "endOfTrack" });
        break;
      }
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      state.offset += readVlq(state);
      continue;
    }

    const eventType = status >> 4;
    const channel = status & 0x0f;
    const data1 = data[state.offset++];
    const oneDataByte = eventType === 0xc || eventType === 0xd;
    const data2 = oneDataByte ? null : data[state.offset++];

    if (eventType === 0x9 && data2 > 0) {
      const key = `${channel}:${data1}`;
      const queue = activeNotes.get(key) ?? [];
      queue.push({ tick, velocity: data2, channel });
      activeNotes.set(key, queue);
    } else if (eventType === 0x8 || (eventType === 0x9 && data2 === 0)) {
      const key = `${channel}:${data1}`;
      const queue = activeNotes.get(key);
      const start = queue?.shift();
      if (start) {
        notes.push({
          tick: start.tick,
          durationTicks: tick - start.tick,
          midi: data1,
          velocity: start.velocity,
          channel,
        });
      }
    } else if (eventType === 0xc) {
      programs.push({ tick, channel, program: data1 });
    }
  }

  tracks.push({
    index: trackIndex,
    name,
    endTick: tick,
    noteCount: notes.length,
    pitchRange: notes.length
      ? [Math.min(...notes.map(({ midi }) => midi)), Math.max(...notes.map(({ midi }) => midi))]
      : null,
    channels: [...new Set(notes.map(({ channel }) => channel))],
    programs,
    events,
    notes: notes.sort((a, b) => a.tick - b.tick || a.midi - b.midi),
  });
  cursor = chunk.end;
}

const tempoMap = [...tempos].sort((a, b) => a.tick - b.tick);
if (tempoMap.length === 0 || tempoMap[0].tick !== 0) {
  tempoMap.unshift({ tick: 0, bpm: 120, microsecondsPerQuarter: 500_000, trackIndex: -1 });
}

const secondsAtTick = (targetTick) => {
  let seconds = 0;
  let previousTick = 0;
  let microsecondsPerQuarter = tempoMap[0].microsecondsPerQuarter;
  for (const tempo of tempoMap.slice(1)) {
    if (tempo.tick >= targetTick) break;
    seconds += ((tempo.tick - previousTick) / ticksPerQuarter) * (microsecondsPerQuarter / 1_000_000);
    previousTick = tempo.tick;
    microsecondsPerQuarter = tempo.microsecondsPerQuarter;
  }
  return seconds + ((targetTick - previousTick) / ticksPerQuarter) * (microsecondsPerQuarter / 1_000_000);
};

const endTick = Math.max(...tracks.map(({ endTick: trackEnd }) => trackEnd));
const summary = {
  source: inputPath,
  format,
  trackCount,
  ticksPerQuarter,
  endTick,
  durationSeconds: secondsAtTick(endTick),
  tempos: tempoMap,
  timeSignatures: timeSignatures.sort((a, b) => a.tick - b.tick),
  keySignatures: keySignatures.sort((a, b) => a.tick - b.tick),
  markers: markers.sort((a, b) => a.tick - b.tick),
  tracks,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
