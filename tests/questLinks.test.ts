import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicQuestShareUrl,
  buildQuestShareUrl,
  getQuestIdFromSearch,
} from "@/lib/questLinks";

test("getQuestIdFromSearch reads shared quest id", () => {
  assert.equal(getQuestIdFromSearch("?quest=abc-123"), "abc-123");
});

test("getQuestIdFromSearch reads polluted shared quest id", () => {
  assert.equal(
    getQuestIdFromSearch(
      "?quest=457bd1e6-face-4071-b7e8-ed1880d86dbd%20Study%20Session%20at%20Coda",
    ),
    "457bd1e6-face-4071-b7e8-ed1880d86dbd",
  );
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

test("buildPublicQuestShareUrl creates event landing links", () => {
  assert.equal(
    buildPublicQuestShareUrl("share token", "https://plus1.example/?quest=old"),
    "https://plus1.example/e/share%20token",
  );
});
