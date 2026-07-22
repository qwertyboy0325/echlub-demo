declare module "tone" {
  export type BasicPlaybackState = "started" | "stopped" | "paused";
  export const start: () => Promise<void>;
  export const getTransport: () => any;
  export const getDraw: () => any;
  export const getDestination: () => any;
  export class Volume { constructor(...args: any[]); volume: any; connect(...args: any[]): any; chain(...args: any[]): any; dispose(): void; }
  export class Limiter { constructor(...args: any[]); dispose(): void; }
  export class Filter { constructor(...args: any[]); frequency: any; dispose(): void; }
  export class FeedbackDelay { constructor(...args: any[]); wet: any; connect(...args: any[]): any; dispose(): void; }
  export class Reverb { constructor(...args: any[]); wet: any; connect(...args: any[]): any; dispose(): void; }
  export class MembraneSynth { constructor(...args: any[]); connect(...args: any[]): any; triggerAttackRelease(...args: any[]): any; dispose(): void; }
  export class NoiseSynth { constructor(...args: any[]); connect(...args: any[]): any; triggerAttackRelease(...args: any[]): any; dispose(): void; }
  export class MetalSynth { constructor(...args: any[]); connect(...args: any[]): any; triggerAttackRelease(...args: any[]): any; dispose(): void; }
  export class MonoSynth { constructor(...args: any[]); connect(...args: any[]): any; triggerAttackRelease(...args: any[]): any; dispose(): void; }
  export class Synth { constructor(...args: any[]); connect(...args: any[]): any; triggerAttackRelease(...args: any[]): any; dispose(): void; }
  export class PolySynth { constructor(...args: any[]); connect(...args: any[]): any; triggerAttackRelease(...args: any[]): any; dispose(): void; }
}

declare module "gsap" {
  export const gsap: any;
}
