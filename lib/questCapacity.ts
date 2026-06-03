import type { Quest } from "@/types/quest";

type CapacitySource = Pick<Quest, "goingCount" | "maxPeople">;
type FullSource = Pick<Quest, "goingCount" | "maxPeople" | "status">;

export function getOpenSpots({ goingCount, maxPeople }: CapacitySource) {
  if (maxPeople === null) {
    return null;
  }

  return Math.max(0, maxPeople - goingCount);
}

export function getOpenSpotsForScore(
  { goingCount, maxPeople }: CapacitySource,
  cap = 6,
) {
  const openSpots = getOpenSpots({ goingCount, maxPeople });
  return openSpots === null ? cap : Math.min(openSpots, cap);
}

export function isQuestFull({ goingCount, maxPeople, status }: FullSource) {
  return status === "open" && maxPeople !== null && goingCount >= maxPeople;
}

export function formatGoingLabel({ goingCount, maxPeople }: CapacitySource) {
  return maxPeople === null
    ? `${goingCount} going`
    : `${goingCount}/${maxPeople} going`;
}

export function formatOpenSpotsLabel(source: CapacitySource) {
  const openSpots = getOpenSpots(source);
  return openSpots === null ? "Open" : `${openSpots} open`;
}

export function formatCapacitySummary(source: CapacitySource) {
  return `${formatGoingLabel(source)} · ${formatOpenSpotsLabel(source)}`;
}
