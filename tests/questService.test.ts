import test from "node:test";
import assert from "node:assert/strict";
import { formatQuestTime, normalizeQuestCategory } from "@/lib/questService";

test("normalizeQuestCategory maps legacy Errand rows to Other", () => {
  assert.equal(normalizeQuestCategory("Errand"), "Other");
  assert.equal(normalizeQuestCategory("Sidequest"), "Other");
});

test("normalizeQuestCategory keeps valid event categories", () => {
  assert.equal(normalizeQuestCategory("Other"), "Other");
  assert.equal(normalizeQuestCategory("Food"), "Food");
});

test("normalizeQuestCategory falls back safely for unknown values", () => {
  assert.equal(normalizeQuestCategory("Mystery"), "Social");
  assert.equal(normalizeQuestCategory(null), "Social");
});

test("formatQuestTime displays missing start time as ASAP", () => {
  assert.equal(formatQuestTime(null), "ASAP");
});
