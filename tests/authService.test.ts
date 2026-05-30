import test from "node:test";
import assert from "node:assert/strict";
import {
  isLikelyAutoDisplayName,
  normalizePhoneNumber,
} from "@/lib/authService";

test("normalizePhoneNumber adds +1 for 10-digit US numbers", () => {
  assert.equal(normalizePhoneNumber("510 496 1239"), "+15104961239");
});

test("normalizePhoneNumber keeps explicit international prefix", () => {
  assert.equal(normalizePhoneNumber("+44 20 7946 0018"), "+442079460018");
});

test("normalizePhoneNumber returns empty when no digits", () => {
  assert.equal(normalizePhoneNumber("   "), "");
});

test("isLikelyAutoDisplayName detects generated fallback names", () => {
  assert.equal(isLikelyAutoDisplayName("plus1 1234"), true);
  assert.equal(isLikelyAutoDisplayName("plus1 user"), true);
  assert.equal(isLikelyAutoDisplayName("plus1 1234-ab12cd"), true);
});

test("isLikelyAutoDisplayName ignores custom display names", () => {
  assert.equal(isLikelyAutoDisplayName("Allen"), false);
  assert.equal(isLikelyAutoDisplayName("Campus Crew"), false);
});
