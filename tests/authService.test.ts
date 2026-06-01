import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_PHOTO_MAX_BYTES,
  isLikelyAutoDisplayName,
  isValidE164PhoneNumber,
  isValidHandle,
  isValidUsPhoneParts,
  normalizeHandle,
  normalizePhoneNumber,
  normalizePronouns,
  normalizeProfileEmail,
  normalizeUsPhoneParts,
  normalizeWebsiteUrl,
  validateProfilePhotoFile,
} from "@/lib/authService";

test("normalizeProfileEmail treats empty phone-auth email as null", () => {
  assert.equal(normalizeProfileEmail(""), null);
  assert.equal(normalizeProfileEmail("   "), null);
  assert.equal(normalizeProfileEmail(null), null);
  assert.equal(normalizeProfileEmail(undefined), null);
  assert.equal(normalizeProfileEmail("user@example.com"), "user@example.com");
});

test("normalizeUsPhoneParts builds +1 E.164 from area code and local number", () => {
  assert.equal(normalizeUsPhoneParts("510", "4961239"), "+15104961239");
  assert.equal(normalizeUsPhoneParts("800", "5550123"), "+18005550123");
  assert.equal(isValidUsPhoneParts("510", "4961239"), true);
});

test("normalizeUsPhoneParts rejects incomplete parts", () => {
  assert.equal(normalizeUsPhoneParts("51", "4961239"), "");
  assert.equal(normalizeUsPhoneParts("510", "496123"), "");
  assert.equal(isValidUsPhoneParts("510", "496123"), false);
});

test("normalizePhoneNumber adds +1 for 10-digit US numbers", () => {
  assert.equal(normalizePhoneNumber("510 496 1239"), "+15104961239");
  assert.equal(normalizePhoneNumber("(510) 496-1239"), "+15104961239");
  assert.equal(normalizePhoneNumber("15104961239"), "+15104961239");
});

test("normalizePhoneNumber keeps explicit international prefix", () => {
  assert.equal(normalizePhoneNumber("+44 20 7946 0018"), "+442079460018");
  assert.equal(normalizePhoneNumber("+1-510-496-1239"), "+15104961239");
});

test("normalizePhoneNumber converts 00 international prefix", () => {
  assert.equal(normalizePhoneNumber("0015104961239"), "+15104961239");
});

test("normalizePhoneNumber returns empty when no digits", () => {
  assert.equal(normalizePhoneNumber("   "), "");
});

test("isValidE164PhoneNumber accepts normalized numbers", () => {
  assert.equal(isValidE164PhoneNumber("+15104961239"), true);
  assert.equal(isValidE164PhoneNumber("+442079460018"), true);
});

test("isValidE164PhoneNumber rejects invalid numbers", () => {
  assert.equal(isValidE164PhoneNumber("+0015104961239"), false);
  assert.equal(isValidE164PhoneNumber("15104961239"), false);
  assert.equal(isValidE164PhoneNumber("+"), false);
});

test("isLikelyAutoDisplayName detects generated fallback names", () => {
  assert.equal(isLikelyAutoDisplayName("plus1 1234"), true);
  assert.equal(isLikelyAutoDisplayName("plus1 user"), true);
  assert.equal(isLikelyAutoDisplayName("plus1 1234-ab12cd"), true);
});

test("isLikelyAutoDisplayName ignores custom display names", () => {
  assert.equal(isLikelyAutoDisplayName("Allen"), false);
  assert.equal(isLikelyAutoDisplayName("Study Crew"), false);
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

test("normalizePronouns trims optional pronouns", () => {
  assert.equal(normalizePronouns("  she / her  "), "she / her");
  assert.equal(normalizePronouns("they     / them"), "they / them");
  assert.equal(normalizePronouns("   "), null);
});

test("normalizePronouns rejects long pronouns", () => {
  assert.throws(() => normalizePronouns("a".repeat(33)), /32 characters/);
});

test("validateProfilePhotoFile accepts web-renderable profile photos", () => {
  assert.doesNotThrow(() =>
    validateProfilePhotoFile({
      size: PROFILE_PHOTO_MAX_BYTES,
      type: "image/jpeg",
    }),
  );
});

test("validateProfilePhotoFile rejects unsupported iPhone photo formats", () => {
  assert.throws(
    () =>
      validateProfilePhotoFile({
        size: 1024,
        type: "image/heic",
      }),
    /JPG, PNG, or WebP/,
  );
});

test("validateProfilePhotoFile rejects oversized profile photos", () => {
  assert.throws(
    () =>
      validateProfilePhotoFile({
        size: PROFILE_PHOTO_MAX_BYTES + 1,
        type: "image/png",
      }),
    /5 MB or smaller/,
  );
});
