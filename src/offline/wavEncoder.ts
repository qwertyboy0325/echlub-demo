export interface WavEncodingOptions {
  sampleRate: number;
  channels: number;
  bitDepth?: 16 | 24;
}

let wavEncodeInvocationCount = 0;

export function resetWavEncodeCountForTests(): void {
  wavEncodeInvocationCount = 0;
}

export function getWavEncodeCountForTests(): number {
  return wavEncodeInvocationCount;
}

export function encodePcmWav(
  channels: Float32Array[],
  options: WavEncodingOptions,
): Uint8Array {
  wavEncodeInvocationCount += 1;
  const bitDepth = options.bitDepth ?? 24;
  return bitDepth === 16
    ? encode16BitPcmWav(channels, options)
    : encode24BitPcmWav(channels, options);
}

export function encode16BitPcmWav(
  channels: Float32Array[],
  options: WavEncodingOptions,
): Uint8Array {
  const channelCount = options.channels;
  const sampleCount = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = sampleCount * blockAlign;
  const out = new Uint8Array(44 + dataSize);
  writeWavHeader(out, {
    channelCount,
    sampleRate: options.sampleRate,
    blockAlign,
    bitDepth: 16,
    dataSize,
  });

  let offset = 44;
  const scale = 0x7fff;
  if (channelCount === 2 && channels.length >= 2) {
    const left = channels[0]!;
    const right = channels[1]!;
    for (let i = 0; i < sampleCount; i += 1) {
      offset = writeSample16(out, offset, clampSample(left[i] ?? 0), scale);
      offset = writeSample16(out, offset, clampSample(right[i] ?? 0), scale);
    }
  } else {
    for (let i = 0; i < sampleCount; i += 1) {
      for (let ch = 0; ch < channelCount; ch += 1) {
        offset = writeSample16(out, offset, clampSample(channels[ch]?.[i] ?? 0), scale);
      }
    }
  }
  return out;
}

export function encode24BitPcmWav(
  channels: Float32Array[],
  options: WavEncodingOptions,
): Uint8Array {
  const channelCount = options.channels;
  const sampleCount = channels[0]?.length ?? 0;
  const bytesPerSample = 3;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = sampleCount * blockAlign;
  const out = new Uint8Array(44 + dataSize);
  writeWavHeader(out, {
    channelCount,
    sampleRate: options.sampleRate,
    blockAlign,
    bitDepth: 24,
    dataSize,
  });

  let offset = 44;
  const scale = 0x7fffff;
  if (channelCount === 2 && channels.length >= 2) {
    const left = channels[0]!;
    const right = channels[1]!;
    for (let i = 0; i < sampleCount; i += 1) {
      offset = writeSample24(out, offset, clampSample(left[i] ?? 0), scale);
      offset = writeSample24(out, offset, clampSample(right[i] ?? 0), scale);
    }
  } else {
    for (let i = 0; i < sampleCount; i += 1) {
      for (let ch = 0; ch < channelCount; ch += 1) {
        offset = writeSample24(out, offset, clampSample(channels[ch]?.[i] ?? 0), scale);
      }
    }
  }
  return out;
}

function writeWavHeader(
  out: Uint8Array,
  input: {
    channelCount: number;
    sampleRate: number;
    blockAlign: number;
    bitDepth: 16 | 24;
    dataSize: number;
  },
): void {
  const header = new DataView(out.buffer, out.byteOffset, out.byteLength);
  writeAscii(header, 0, "RIFF");
  header.setUint32(4, 36 + input.dataSize, true);
  writeAscii(header, 8, "WAVE");
  writeAscii(header, 12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, input.channelCount, true);
  header.setUint32(24, input.sampleRate, true);
  header.setUint32(28, input.sampleRate * input.blockAlign, true);
  header.setUint16(32, input.blockAlign, true);
  header.setUint16(34, input.bitDepth, true);
  writeAscii(header, 36, "data");
  header.setUint32(40, input.dataSize, true);
}

function writeSample16(out: Uint8Array, offset: number, sample: number, scale: number): number {
  const intSample = Math.round(sample * scale);
  out[offset] = intSample & 0xff;
  out[offset + 1] = (intSample >> 8) & 0xff;
  return offset + 2;
}

function writeSample24(out: Uint8Array, offset: number, sample: number, scale: number): number {
  const intSample = Math.round(sample * scale);
  out[offset] = intSample & 0xff;
  out[offset + 1] = (intSample >> 8) & 0xff;
  out[offset + 2] = (intSample >> 16) & 0xff;
  return offset + 3;
}

export function audioBufferToChannelArrays(buffer: AudioBuffer): Float32Array[] {
  return Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
}

export function parseWavPcmLength(wav: Uint8Array): {
  sampleCount: number;
  channels: number;
  sampleRate: number;
  bitDepth: number;
} {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitDepth = view.getUint16(34, true);
  const dataSize = view.getUint32(40, true);
  const bytesPerSample = bitDepth / 8;
  const sampleCount = dataSize / (channels * bytesPerSample);
  return { sampleCount, channels, sampleRate, bitDepth };
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function clampSample(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
