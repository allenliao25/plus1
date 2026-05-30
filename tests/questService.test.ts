import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuestCategory } from "@/lib/questService";

test("normalizeQuestCategory maps legacy Errand rows to Sidequest", () => {
  assert.equal(normalizeQuestCategory("Errand"), "Sidequest");
});

test("normalizeQuestCategory keeps valid event categories", () => {
  assert.equal(normalizeQuestCategory("Sidequest"), "Sidequest");
  assert.equal(normalizeQuestCategory("Food"), "Food");
});

test("normalizeQuestCategory falls back safely for unknown values", () => {
  assert.equal(normalizeQuestCategory("Mystery"), "Social");
  assert.equal(normalizeQuestCategory(null), "Social");
});
