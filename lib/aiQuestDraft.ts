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
- "description": one or two friendly sentences about the plan (string)
- "maxPeople": integer between 2 and 12 for total group size
Pick the closest category from the allowed list. If a value is missing, use a sensible default rather than inventing fake specifics.`;

type ChatTextContent = { type: "text"; text: string };
type ChatImageContent = { type: "image_url"; image_url: { url: string } };
type ChatUserContent = string | Array<ChatTextContent | ChatImageContent>;

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
export function parseQuestDraft(raw: unknown): NewQuestInput {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  const maxPeopleNumber = Number(record.maxPeople);
  const maxPeople = Number.isFinite(maxPeopleNumber)
    ? Math.min(12, Math.max(2, Math.round(maxPeopleNumber)))
    : 4;

  return {
    title: asString(record.title),
    category: isQuestCategory(record.category) ? record.category : "Social",
    location: asString(record.location),
    startTime: asString(record.startTime),
    description: asString(record.description),
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
): Promise<NewQuestInput> {
  const apiKey = getOpenAiKey();
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

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
        { role: "system", content: SYSTEM_PROMPT },
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

  return parseQuestDraft(parsed);
}
