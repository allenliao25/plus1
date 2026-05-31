import test from "node:test";
import assert from "node:assert/strict";
import { parseQuestDraft } from "@/lib/aiQuestDraft";

test("parseQuestDraft ignores generated descriptions", () => {
  const draft = parseQuestDraft({
    title: "Study Session at Green Library",
    category: "Study",
    location: "Green Library",
    startTime: "2026-06-01T20:00",
    description: "Join me for a focused study session.",
    maxPeople: 2,
  });

  assert.deepEqual(draft, {
    title: "Study Session at Green Library",
    category: "Study",
    location: "Green Library",
    startTime: "2026-06-01T20:00",
    description: "",
    maxPeople: 2,
  });
});
