export interface AudioLevelMetrics {
  peakDbfs: number;
  rmsDbfs: number;
  crestFactor: number;
  dcOffset: number;
  clippingSampleCount: number;
  spectralCentroidHz: number;
  energyRatio20To250: number;
  energyRatio250To800: number;
  energyRatio800To3000: number;
  energyRatioAbove3000: number;
}

export interface SceneAnalysisRange {
  sceneId: string;
  startSample: number;
  endSample: number;
}

export interface AnalysisMethodDocument {
  linearMetricsSampleRate: number;
  spectralAnalysisSampleRate: number;
  fftSize: number;
  hopSize: number;
  spectralInput: "mono-downmix";
  window: "hann";
  transform: "radix-2-fft";
}

export const DEFAULT_ANALYSIS_METHOD: AnalysisMethodDocument = {
  linearMetricsSampleRate: 0,
  spectralAnalysisSampleRate: 16000,
  fftSize: 4096,
  hopSize: 4096,
  spectralInput: "mono-downmix",
  window: "hann",
  transform: "radix-2-fft",
};

export interface RenderAnalysisResult {
  wholeRender: AudioLevelMetrics;
  perScene: Record<string, AudioLevelMetrics>;
  method: AnalysisMethodDocument;
}

interface LinearAccumulator {
  peak: number;
  sumSquares: number;
  sum: number;
  clippingCount: number;
  sampleCount: number;
}

interface SpectralAccumulator {
  b20_250: number;
  b250_800: number;
  b800_3000: number;
  bAbove3000: number;
  total: number;
  centroidNumerator: number;
}

export function analyzeRenderEvidence(
  channels: Float32Array[],
  sampleRate: number,
  sceneRanges: SceneAnalysisRange[],
  method: AnalysisMethodDocument = DEFAULT_ANALYSIS_METHOD,
): RenderAnalysisResult {
  const channelCount = channels.length;
  const sampleCount = channels[0]?.length ?? 0;
  if (sampleCount === 0) {
    return {
      wholeRender: emptyMetrics(),
      perScene: Object.fromEntries(sceneRanges.map((range) => [range.sceneId, emptyMetrics()])),
      method: { ...method, linearMetricsSampleRate: sampleRate },
    };
  }

  const sortedRanges = [...sceneRanges].sort((a, b) => a.startSample - b.startSample);
  const linearWhole = createLinearAccumulator();
  const linearByScene = new Map<string, LinearAccumulator>(
    sortedRanges.map((range) => [range.sceneId, createLinearAccumulator()]),
  );
  let rangeIndex = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    while (
      rangeIndex < sortedRanges.length
      && i >= sortedRanges[rangeIndex]!.endSample
    ) {
      rangeIndex += 1;
    }
    const activeRange = sortedRanges[rangeIndex];
    const inActiveScene = activeRange
      && i >= activeRange.startSample
      && i < activeRange.endSample;

    let mono = 0;
    for (let ch = 0; ch < channelCount; ch += 1) {
      mono += channels[ch]![i]! / channelCount;
    }
    accumulateLinear(linearWhole, mono);
    if (inActiveScene) {
      accumulateLinear(linearByScene.get(activeRange.sceneId)!, mono);
    }
  }

  const spectralWhole = createSpectralAccumulator();
  const spectralByScene = new Map<string, SpectralAccumulator>(
    sortedRanges.map((range) => [range.sceneId, createSpectralAccumulator()]),
  );
  const resolvedMethod: AnalysisMethodDocument = {
    ...method,
    linearMetricsSampleRate: sampleRate,
  };
  accumulateSpectralMetrics(
    channels,
    sampleRate,
    sortedRanges,
    resolvedMethod,
    spectralWhole,
    spectralByScene,
  );

  const perScene: Record<string, AudioLevelMetrics> = {};
  for (const range of sortedRanges) {
    perScene[range.sceneId] = finalizeMetrics(
      linearByScene.get(range.sceneId)!,
      spectralByScene.get(range.sceneId)!,
    );
  }

  return {
    wholeRender: finalizeMetrics(linearWhole, spectralWhole),
    perScene,
    method: resolvedMethod,
  };
}

export function analyzeInterleavedChannels(
  channels: Float32Array[],
  sampleRate: number,
): AudioLevelMetrics {
  return analyzeRenderEvidence(channels, sampleRate, []).wholeRender;
}

export function analyzeSceneRanges(
  channels: Float32Array[],
  sampleRate: number,
  ranges: SceneAnalysisRange[],
): Record<string, AudioLevelMetrics> {
  return analyzeRenderEvidence(channels, sampleRate, ranges).perScene;
}

function accumulateLinear(acc: LinearAccumulator, sample: number): void {
  const abs = Math.abs(sample);
  acc.peak = Math.max(acc.peak, abs);
  acc.sumSquares += sample * sample;
  acc.sum += sample;
  if (abs >= 1) acc.clippingCount += 1;
  acc.sampleCount += 1;
}

function createLinearAccumulator(): LinearAccumulator {
  return { peak: 0, sumSquares: 0, sum: 0, clippingCount: 0, sampleCount: 0 };
}

function createSpectralAccumulator(): SpectralAccumulator {
  return {
    b20_250: 0,
    b250_800: 0,
    b800_3000: 0,
    bAbove3000: 0,
    total: 0,
    centroidNumerator: 0,
  };
}

function finalizeMetrics(
  linear: LinearAccumulator,
  spectral: SpectralAccumulator,
): AudioLevelMetrics {
  if (linear.sampleCount === 0) return emptyMetrics();
  const rms = Math.sqrt(linear.sumSquares / linear.sampleCount);
  const peakDbfs = linearToDbfs(linear.peak);
  const rmsDbfs = linearToDbfs(rms);
  const crestFactor = linear.peak > 0 && rms > 0 ? linear.peak / rms : 0;
  const total = spectral.total || 1;
  return {
    peakDbfs,
    rmsDbfs,
    crestFactor,
    dcOffset: linear.sum / linear.sampleCount,
    clippingSampleCount: linear.clippingCount,
    spectralCentroidHz: spectral.centroidNumerator / total,
    energyRatio20To250: spectral.b20_250 / total,
    energyRatio250To800: spectral.b250_800 / total,
    energyRatio800To3000: spectral.b800_3000 / total,
    energyRatioAbove3000: spectral.bAbove3000 / total,
  };
}

function accumulateSpectralMetrics(
  channels: Float32Array[],
  sampleRate: number,
  sceneRanges: SceneAnalysisRange[],
  method: AnalysisMethodDocument,
  spectralWhole: SpectralAccumulator,
  spectralByScene: Map<string, SpectralAccumulator>,
): void {
  const channelCount = channels.length;
  const sampleCount = channels[0]?.length ?? 0;
  const spectralRate = method.spectralAnalysisSampleRate;
  const decimation = Math.max(1, Math.round(sampleRate / spectralRate));
  const effectiveSpectralRate = sampleRate / decimation;
  const { fftSize, hopSize } = method;
  const downsampledLength = Math.ceil(sampleCount / decimation);
  const monoDownsampled = new Float32Array(downsampledLength);
  for (let dsIndex = 0, srcIndex = 0; dsIndex < downsampledLength; dsIndex += 1, srcIndex += decimation) {
    let mono = 0;
    for (let ch = 0; ch < channelCount; ch += 1) {
      mono += channels[ch]![srcIndex]! / channelCount;
    }
    monoDownsampled[dsIndex] = mono;
  }

  let rangeIndex = 0;
  for (let offset = 0; offset + fftSize <= monoDownsampled.length; offset += hopSize) {
    const centerSample = Math.min(
      sampleCount - 1,
      Math.round(((offset + fftSize / 2) * decimation)),
    );
    while (
      rangeIndex < sceneRanges.length
      && centerSample >= sceneRanges[rangeIndex]!.endSample
    ) {
      rangeIndex += 1;
    }
    const activeRange = sceneRanges[rangeIndex];
    const inActiveScene = activeRange
      && centerSample >= activeRange.startSample
      && centerSample < activeRange.endSample;

    const window = monoDownsampled.subarray(offset, offset + fftSize);
    const spectrum = magnitudeSpectrum(window);
    const bands = computeSpectralBands(spectrum, effectiveSpectralRate, fftSize);
    mergeSpectralBands(spectralWhole, bands);
    if (inActiveScene) {
      mergeSpectralBands(spectralByScene.get(activeRange.sceneId)!, bands);
    }
  }
}

function computeSpectralBands(
  spectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
): SpectralAccumulator {
  const bands = createSpectralAccumulator();
  const binWidth = sampleRate / fftSize;
  for (let bin = 1; bin < spectrum.length; bin += 1) {
    const freq = bin * binWidth;
    const energy = spectrum[bin]! * spectrum[bin]!;
    bands.total += energy;
    bands.centroidNumerator += freq * energy;
    if (freq < 250) bands.b20_250 += energy;
    else if (freq < 800) bands.b250_800 += energy;
    else if (freq < 3000) bands.b800_3000 += energy;
    else bands.bAbove3000 += energy;
  }
  return bands;
}

function mergeSpectralBands(target: SpectralAccumulator, source: SpectralAccumulator): void {
  target.b20_250 += source.b20_250;
  target.b250_800 += source.b250_800;
  target.b800_3000 += source.b800_3000;
  target.bAbove3000 += source.bAbove3000;
  target.total += source.total;
  target.centroidNumerator += source.centroidNumerator;
}

function magnitudeSpectrum(window: Float32Array): Float32Array {
  const n = window.length;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    real[i] = window[i]! * hann;
  }
  fftInPlace(real, imag);
  const magnitudes = new Float32Array(n / 2);
  for (let i = 0; i < magnitudes.length; i += 1) {
    magnitudes[i] = Math.hypot(real[i]!, imag[i]!);
  }
  return magnitudes;
}

function fftInPlace(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j]!, real[i]!];
      [imag[i], imag[j]] = [imag[j]!, imag[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenCos = Math.cos(ang);
    const wlenSin = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wCos = 1;
      let wSin = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const uReal = real[i + j]!;
        const uImag = imag[i + j]!;
        const vReal = real[i + j + len / 2]! * wCos - imag[i + j + len / 2]! * wSin;
        const vImag = real[i + j + len / 2]! * wSin + imag[i + j + len / 2]! * wCos;
        real[i + j] = uReal + vReal;
        imag[i + j] = uImag + vImag;
        real[i + j + len / 2] = uReal - vReal;
        imag[i + j + len / 2] = uImag - vImag;
        const nextCos = wCos * wlenCos - wSin * wlenSin;
        wSin = wCos * wlenSin + wSin * wlenCos;
        wCos = nextCos;
      }
    }
  }
}

function linearToDbfs(value: number): number {
  if (value <= 0) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(value);
}

function emptyMetrics(): AudioLevelMetrics {
  return {
    peakDbfs: Number.NEGATIVE_INFINITY,
    rmsDbfs: Number.NEGATIVE_INFINITY,
    crestFactor: 0,
    dcOffset: 0,
    clippingSampleCount: 0,
    spectralCentroidHz: 0,
    energyRatio20To250: 0,
    energyRatio250To800: 0,
    energyRatio800To3000: 0,
    energyRatioAbove3000: 0,
  };
}

export function bufferPeakAbs(channels: Float32Array[]): number {
  let peak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) {
      peak = Math.max(peak, Math.abs(channel[i]!));
    }
  }
  return peak;
}
