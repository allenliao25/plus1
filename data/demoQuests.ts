import type { Quest, QuestCategory } from "@/types/quest";

export const questCategories: QuestCategory[] = [
  "Food",
  "Study",
  "Fitness",
  "Errand",
  "Outdoors",
  "Social",
];

export const demoQuests: Quest[] = [
  {
    id: "quest-1",
    title: "Dinner at Wilbur",
    category: "Food",
    location: "Wilbur Dining",
    startTime: "Today, 6:15 PM",
    description:
      "Grabbing dinner after section. Easy yes, no need to stay long.",
    creator: "Maya",
    goingCount: 3,
    maxPeople: 6,
  },
  {
    id: "quest-2",
    title: "Study block at Green",
    category: "Study",
    location: "Green Library",
    startTime: "Today, 8:00 PM",
    description:
      "Quiet table for a focused hour. Bring whatever you need to finish.",
    creator: "Theo",
    goingCount: 2,
    maxPeople: 4,
  },
  {
    id: "quest-3",
    title: "Quick campus walk",
    category: "Outdoors",
    location: "Main Quad",
    startTime: "Tomorrow, 10:30 AM",
    description:
      "Short loop before class. Good for getting outside without making it a whole thing.",
    creator: "Ari",
    goingCount: 1,
    maxPeople: 5,
  },
  {
    id: "quest-4",
    title: "Late Safeway run",
    category: "Errand",
    location: "Safeway on El Camino",
    startTime: "Tonight, 10:45 PM",
    description:
      "Picking up snacks and a few basics. Join if you need something too.",
    creator: "Nina",
    goingCount: 4,
    maxPeople: 5,
  },
  {
    id: "quest-5",
    title: "Lift at AOERC",
    category: "Fitness",
    location: "AOERC",
    startTime: "Tomorrow, 4:00 PM",
    description:
      "Low-pressure gym session. Planning on legs and a quick cooldown.",
    creator: "Cal",
    goingCount: 2,
    maxPeople: 3,
  },
];
