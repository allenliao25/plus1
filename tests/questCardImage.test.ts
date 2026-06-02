import test from "node:test";
import assert from "node:assert/strict";
import {
  QUEST_CARD_IMAGE_MAX_BYTES,
  normalizeQuestCategory,
  validateQuestCardImageFile,
} from "@/lib/questService";

test("validateQuestCardImageFile accepts image files within the limit", () => {
  assert.doesNotThrow(() =>
    validateQuestCardImageFile({
      size: QUEST_CARD_IMAGE_MAX_BYTES,
      type: "image/jpeg",
    }),
  );
});

test("validateQuestCardImageFile rejects non-image files", () => {
  assert.throws(
    () =>
      validateQuestCardImageFile({
        size: 1024,
        type: "application/pdf",
      }),
    /Choose an image file/,
  );
});

test("validateQuestCardImageFile rejects oversized images", () => {
  assert.throws(
    () =>
      validateQuestCardImageFile({
        size: QUEST_CARD_IMAGE_MAX_BYTES + 1,
        type: "image/png",
      }),
    /8 MB or smaller/,
  );
});

test("normalizeQuestCategory maps legacy sidequest values to Sidequest", () => {
  assert.equal(normalizeQuestCategory("Errand"), "Sidequest");
  assert.equal(normalizeQuestCategory("Sidequest"), "Sidequest");
});
