import test from "node:test";
import assert from "node:assert/strict";
import {
  isLikelyAutoDisplayName,
  isValidHandle,
  normalizeHandle,
  normalizePhoneNumber,
  normalizeWebsiteUrl,
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

test("normalizeHandle lowercases and removes a leading at sign", () => {
  assert.equal(normalizeHandle("@Allen.Liao"), "allen.liao");
});

test("isValidHandle accepts Instagram-style handles", () => {
  assert.equal(isValidHandle("allen.liao"), true);
  assert.equal(isValidHandle("allen_liao"), true);
  assert.equal(isValidHandle("allen123"), true);
});

test("isValidHandle rejects invalid handles", () => {
  assert.equal(isValidHandle("al"), false);
  assert.equal(isValidHandle("allen liao"), false);
  assert.equal(isValidHandle("allen-liao"), false);
  assert.equal(isValidHandle("a".repeat(31)), false);
});

test("normalizeWebsiteUrl adds https to bare domains", () => {
  assert.equal(normalizeWebsiteUrl("plus1.app"), "https://plus1.app/");
});

test("normalizeWebsiteUrl keeps http and https URLs", () => {
  assert.equal(normalizeWebsiteUrl("https://plus1.app/me"), "https://plus1.app/me");
  assert.equal(normalizeWebsiteUrl("http://localhost:3000"), "http://localhost:3000/");
});

test("normalizeWebsiteUrl returns null for empty values", () => {
  assert.equal(normalizeWebsiteUrl("   "), null);
});
