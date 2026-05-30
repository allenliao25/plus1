import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/ai/status/route";

test("AI status reports configured when OPENAI_API_KEY is set", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";

  try {
    const response = await GET();
    const payload = (await response.json()) as { configured: boolean };
    assert.equal(payload.configured, true);
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }
  }
});

test("AI status reports unavailable when OPENAI_API_KEY is missing", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const response = await GET();
    const payload = (await response.json()) as { configured: boolean };
    assert.equal(payload.configured, false);
  } finally {
    if (previousKey !== undefined) {
      process.env.OPENAI_API_KEY = previousKey;
    }
  }
});
