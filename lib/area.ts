export const DEFAULT_AREA = "Demo Area";

export const AREA_OPTIONS = [
  DEFAULT_AREA,
  "Bay Area, CA",
  "Los Angeles, CA",
  "New York, NY",
  "London, UK",
  "Paris, FR",
] as const;

export type AreaOption = (typeof AREA_OPTIONS)[number];

export function normalizeArea(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";

  return normalized || DEFAULT_AREA;
}
