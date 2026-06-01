import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_RATE_LIMIT_MAX_REQUESTS,
  AI_RATE_LIMIT_WINDOW_MS,
  AI_TEXT_PROMPT_MAX_LENGTH,
  checkAiRateLimit,
  normalizeAiTextPrompt,
} from "@/lib/aiRequestGuards";

test("normalizeAiTextPrompt trims and accepts short prompts", () => {
  assert.equal(normalizeAiTextPrompt("  study tonight  "), "study tonight");
});

test("normalizeAiTextPrompt rejects empty prompts", () => {
  assert.throws(() => normalizeAiTextPrompt("   "), /short description/);
});

test("normalizeAiTextPrompt caps prompt length", () => {
  assert.throws(
    () => normalizeAiTextPrompt("a".repeat(AI_TEXT_PROMPT_MAX_LENGTH + 1)),
    /under 1800 characters/,
  );
});

test("checkAiRateLimit blocks after the per-window limit", () => {
  const userId = `user-${Date.now()}`;
  const now = 1_000;

  for (let index = 0; index < AI_RATE_LIMIT_MAX_REQUESTS; index += 1) {
    assert.equal(checkAiRateLimit(userId, "test", now).allowed, true);
  }

  const limited = checkAiRateLimit(userId, "test", now);
  assert.equal(limited.allowed, false);
  assert.equal(limited.retryAfterSeconds, AI_RATE_LIMIT_WINDOW_MS / 1000);
});
