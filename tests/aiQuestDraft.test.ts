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

test("parseQuestDraft anchors tonight to the current local date", () => {
  const draft = parseQuestDraft(
    {
      title: "Study Session at CoDa",
      category: "Study",
      location: "CoDa",
      startTime: "2023-10-04T20:00",
      maxPeople: 2,
    },
    {
      sourceText:
        "study session at CoDa tonight at 8pm. looking for one other person to join",
      nowLocal: "2026-05-30T18:03",
    },
  );

  assert.equal(draft.startTime, "2026-05-30T20:00");
});

test("parseQuestDraft moves tonight to tomorrow if the time already passed", () => {
  const draft = parseQuestDraft(
    {
      title: "Late Study",
      category: "Study",
      location: "CoDa",
      startTime: "2023-10-04T20:00",
      maxPeople: 2,
    },
    {
      sourceText: "study session tonight at 8pm",
      nowLocal: "2026-05-30T21:03",
    },
  );

  assert.equal(draft.startTime, "2026-05-31T20:00");
});

test("parseQuestDraft removes stale model dates without a relative cue", () => {
  const draft = parseQuestDraft(
    {
      title: "Study Session at CoDa",
      category: "Study",
      location: "CoDa",
      startTime: "2023-10-04T20:00",
      maxPeople: 2,
    },
    {
      sourceText: "study session at CoDa",
      nowLocal: "2026-05-30T18:03",
    },
  );

  assert.equal(draft.startTime, "");
});
