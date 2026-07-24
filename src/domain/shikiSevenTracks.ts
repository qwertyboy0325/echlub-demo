/** Owner seven-track Shared Master inventory (preservation report § Tracks). */
export const SHIKI_SEVEN_TRACK_IDS = [
  "track-alto",
  "track-tenor",
  "track-piano-rh",
  "track-piano-lh",
  "track-guitar",
  "track-bass",
  "track-drums",
] as const;

export type ShikiSevenTrackId = (typeof SHIKI_SEVEN_TRACK_IDS)[number];

export const SHIKI_SEVEN_TRACK_INSTRUMENTS: Record<ShikiSevenTrackId, string> = {
  "track-alto": "alto",
  "track-tenor": "tenor",
  "track-piano-rh": "piano-rh",
  "track-piano-lh": "piano-lh",
  "track-guitar": "guitar",
  "track-bass": "bass",
  "track-drums": "drums",
};
