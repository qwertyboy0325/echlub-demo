export type ExportProfileId = "master" | "quickReview";

export interface ExportProfile {
  id: ExportProfileId;
  label: string;
  sampleRate: number;
  channels: number;
  bitDepth: 16 | 24;
  tailSeconds: number;
}

export const MASTER_EXPORT_PROFILE: ExportProfile = {
  id: "master",
  label: "Master",
  sampleRate: 48000,
  channels: 2,
  bitDepth: 24,
  tailSeconds: 6,
};

export const QUICK_REVIEW_EXPORT_PROFILE: ExportProfile = {
  id: "quickReview",
  label: "Quick Review",
  sampleRate: 32000,
  channels: 2,
  bitDepth: 16,
  tailSeconds: 3,
};

export function resolveExportProfile(id: ExportProfileId): ExportProfile {
  return id === "quickReview" ? QUICK_REVIEW_EXPORT_PROFILE : MASTER_EXPORT_PROFILE;
}
