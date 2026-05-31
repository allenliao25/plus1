import { questCategories } from "@/data/demoQuests";
import type { NewQuestInput, QuestCategory } from "@/types/quest";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You turn casual event descriptions into a structured event draft for a hangout app.
Return ONLY a single JSON object (no markdown, no commentary) with exactly these keys:
- "title": short, catchy event title (string)
- "category": one of ${questCategories.map((c) => `"${c}"`).join(", ")}
- "location": where it happens (string, "" if unknown)
- "startTime": local datetime in "YYYY-MM-DDTHH:mm" 24-hour format, or "" if unknown
- "description": always "" (do not write a caption or description)
- "maxPeople": integer between 2 and 12 for total group size
Pick the closest category from the allowed list. If a value is missing, use a sensible default rather than inventing fake specifics.`;

type ChatTextContent = { type: "text"; text: string };
type ChatImageContent = { type: "image_url"; image_url: { url: string } };
type ChatUserContent = string | Array<ChatTextContent | ChatImageContent>;

export type QuestDraftContext = {
  nowLocal?: string;
  timeZone?: string;
};

function isQuestCategory(value: unknown): value is QuestCategory {
  return (
    typeof value === "string" &&
    (questCategories as string[]).includes(value)
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Coerce an arbitrary model JSON object into a valid NewQuestInput.
 * The model is untrusted, so every field is validated/clamped here.
 */
export function parseQuestDraft(
  raw: unknown,
  options: {
    sourceText?: string;
    nowLocal?: string;
  } = {},
): NewQuestInput {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  const maxPeopleNumber = Number(record.maxPeople);
  const maxPeople = Number.isFinite(maxPeopleNumber)
    ? Math.min(12, Math.max(2, Math.round(maxPeopleNumber)))
    : 4;

  const rawStartTime = asString(record.startTime);
  const inferredStartTime = inferRelativeStartTime(
    options.sourceText,
    options.nowLocal,
  );

  return {
    title: asString(record.title),
    category: isQuestCategory(record.category) ? record.category : "Social",
    location: asString(record.location),
    startTime:
      inferredStartTime ??
      normalizeFutureStartTime(rawStartTime, options.nowLocal),
    description: "",
    maxPeople,
  };
}

function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "Missing OPENAI_API_KEY. Add it to your server environment (.env.local).",
    );
  }
  return key;
}

/**
 * Server-side only. Calls OpenAI with JSON mode and returns a validated draft.
 * `userContent` is a plain prompt string for text, or a multimodal content
 * array (text + image_url) for flyer extraction.
 */
export async function requestQuestDraft(
  userContent: ChatUserContent,
  context: QuestDraftContext = {},
): Promise<NewQuestInput> {
  const apiKey = getOpenAiKey();
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const sourceText = typeof userContent === "string" ? userContent : "";
  const systemPrompt = withDateContext(SYSTEM_PROMPT, context);

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `AI request failed (${response.status}). ${detail.slice(0, 300)}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI returned malformed JSON.");
  }

  return parseQuestDraft(parsed, {
    sourceText,
    nowLocal: context.nowLocal,
  });
}

function withDateContext(prompt: string, context: QuestDraftContext) {
  const nowLocal = isLocalDateTime(context.nowLocal)
    ? context.nowLocal
    : formatLocalDateTime(new Date());
  const timeZone = context.timeZone?.trim() || "the user's local timezone";

  return `${prompt}

Current date/time context:
- Current local datetime: ${nowLocal}
- User timezone: ${timeZone}

Interpret relative phrases like "tonight", "today", "tomorrow", and weekdays from this current local datetime. Never return a startTime before the current local datetime. For "tonight at 8pm", use today's date if 8pm is still upcoming; otherwise use the next upcoming evening.`;
}

function inferRelativeStartTime(sourceText = "", nowLocal?: string) {
  if (!sourceText.trim() || !isLocalDateTime(nowLocal)) {
    return null;
  }

  const text = sourceText.toLowerCase();
  const hasTonight = /\b(tonight|this evening)\b/.test(text);
  const hasToday = /\b(today|tonight|this afternoon|this evening)\b/.test(
    text,
  );
  const hasTomorrow = /\b(tomorrow|tmrw|tmr)\b/.test(text);

  if (!hasToday && !hasTomorrow) {
    return null;
  }

  const time = readPromptTime(text, hasTonight);
  if (!time) {
    return null;
  }

  const now = parseLocalDateTime(nowLocal);
  if (!now) {
    return null;
  }

  const target = new Date(now);
  target.setHours(time.hours, time.minutes, 0, 0);

  if (hasTomorrow) {
    target.setDate(target.getDate() + 1);
  } else if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return formatLocalDateTime(target);
}

function readPromptTime(text: string, preferPm: boolean) {
  const meridiemMatch = text.match(
    /\b(?:at|around|by|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/,
  );
  if (meridiemMatch) {
    return normalizeHour(
      Number(meridiemMatch[1]),
      Number(meridiemMatch[2] ?? 0),
      meridiemMatch[3].startsWith("p") ? "pm" : "am",
    );
  }

  const looseMatch = text.match(/\b(?:at|around|by|@)\s*(\d{1,2})(?::(\d{2}))?\b/);
  if (!looseMatch) {
    return null;
  }

  return normalizeHour(
    Number(looseMatch[1]),
    Number(looseMatch[2] ?? 0),
    preferPm ? "pm" : undefined,
  );
}

function normalizeHour(
  hour: number,
  minutes: number,
  meridiem?: "am" | "pm",
) {
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minutes) ||
    hour < 1 ||
    hour > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  let normalizedHour = hour;
  if (meridiem === "pm" && normalizedHour < 12) {
    normalizedHour += 12;
  }
  if (meridiem === "am" && normalizedHour === 12) {
    normalizedHour = 0;
  }

  return { hours: normalizedHour, minutes };
}

function normalizeFutureStartTime(value: string, nowLocal?: string) {
  if (!value) {
    return "";
  }

  if (!isLocalDateTime(value)) {
    return "";
  }

  const start = parseLocalDateTime(value);
  const now = parseLocalDateTime(nowLocal);
  if (start && now && start.getTime() <= now.getTime()) {
    return "";
  }

  return value;
}

function isLocalDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  );
}

function parseLocalDateTime(value: unknown) {
  if (!isLocalDateTime(value)) {
    return null;
  }

  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
