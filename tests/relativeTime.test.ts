import test from "node:test";
import assert from "node:assert/strict";
import { formatRelativeTime } from "@/lib/relativeTime";

const now = new Date("2026-06-01T12:00:00.000Z").getTime();

test("formatRelativeTime returns Now for timestamps under one minute ago", () => {
  const thirtySecondsAgo = new Date(now - 30_000).toISOString();
  assert.equal(formatRelativeTime(thirtySecondsAgo, now), "Now");
});

test("formatRelativeTime returns minutes for timestamps under one hour ago", () => {
  const fiveMinutesAgo = new Date(now - 5 * 60_000).toISOString();
  assert.equal(formatRelativeTime(fiveMinutesAgo, now), "5m");
});

test("formatRelativeTime returns hours for timestamps under one day ago", () => {
  const threeHoursAgo = new Date(now - 3 * 60 * 60_000).toISOString();
  assert.equal(formatRelativeTime(threeHoursAgo, now), "3h");
});

test("formatRelativeTime returns days for older timestamps", () => {
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60_000).toISOString();
  assert.equal(formatRelativeTime(twoDaysAgo, now), "2d");
});

test("formatRelativeTime returns null for missing or invalid timestamps", () => {
  assert.equal(formatRelativeTime(null, now), null);
  assert.equal(formatRelativeTime("not-a-date", now), null);
});
