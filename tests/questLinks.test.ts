import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestShareUrl, getQuestIdFromSearch } from "@/lib/questLinks";

test("getQuestIdFromSearch reads shared quest id", () => {
  assert.equal(getQuestIdFromSearch("?quest=abc-123"), "abc-123");
});

test("getQuestIdFromSearch ignores missing or empty ids", () => {
  assert.equal(getQuestIdFromSearch("?tab=home"), null);
  assert.equal(getQuestIdFromSearch("?quest=%20%20"), null);
});

test("buildQuestShareUrl preserves origin and sets quest param", () => {
  assert.equal(
    buildQuestShareUrl("quest-1", "https://plus1.example/?tab=home"),
    "https://plus1.example/?tab=home&quest=quest-1",
  );
});
