import type { QuestCategory } from "@/types/quest";

export type SharePalette = {
  base: string;
  dark: string;
  mid: string;
  soft: string;
  pale: string;
};

export const sharePalettes: Record<QuestCategory, SharePalette> = {
  Fitness: {
    base: "#a3e635",
    dark: "#365314",
    mid: "#65a30d",
    soft: "#bef264",
    pale: "#ecfccb",
  },
  Social: {
    base: "#14b8a6",
    dark: "#134e4a",
    mid: "#0f766e",
    soft: "#5eead4",
    pale: "#ccfbf1",
  },
  Sidequest: {
    base: "#f43f5e",
    dark: "#881337",
    mid: "#be123c",
    soft: "#fb7185",
    pale: "#ffe4e6",
  },
  Other: {
    base: "#64748b",
    dark: "#1e293b",
    mid: "#475569",
    soft: "#f59e0b",
    pale: "#e2e8f0",
  },
  Study: {
    base: "#2563eb",
    dark: "#1e3a8a",
    mid: "#1d4ed8",
    soft: "#60a5fa",
    pale: "#dbeafe",
  },
  Food: {
    base: "#f97316",
    dark: "#7c2d12",
    mid: "#ea580c",
    soft: "#fdba74",
    pale: "#ffedd5",
  },
  Outdoors: {
    base: "#16a34a",
    dark: "#14532d",
    mid: "#15803d",
    soft: "#86efac",
    pale: "#dcfce7",
  },
};
