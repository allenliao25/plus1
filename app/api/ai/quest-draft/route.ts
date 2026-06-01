import { requestQuestDraft } from "@/lib/aiQuestDraft";
import {
  checkAiRateLimit,
  normalizeAiTextPrompt,
  requireAuthenticatedUserId,
} from "@/lib/aiRequestGuards";

export const runtime = "nodejs";

type QuestDraftBody = {
  prompt?: unknown;
  context?: {
    nowLocal?: unknown;
    timeZone?: unknown;
  };
};

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUserId(request);

  if ("response" in auth) {
    return auth.response;
  }

  const rateLimit = checkAiRateLimit(auth.userId, "quest-draft");

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Smart Draft is busy. Try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": `${rateLimit.retryAfterSeconds}` },
      },
    );
  }

  let prompt = "";
  let nowLocal = "";
  let timeZone = "";
  let body: QuestDraftBody;

  try {
    body = (await request.json()) as QuestDraftBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    prompt = normalizeAiTextPrompt(body.prompt);
    nowLocal =
      typeof body.context?.nowLocal === "string"
        ? body.context.nowLocal.trim()
        : "";
    timeZone =
      typeof body.context?.timeZone === "string"
        ? body.context.timeZone.trim()
        : "";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Add a short description.";

    return Response.json({ error: message }, { status: 400 });
  }

  try {
    const draft = await requestQuestDraft(prompt, { nowLocal, timeZone });
    return Response.json({ draft });
  } catch (error) {
    if (error instanceof Error && error.message.includes("characters")) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message =
      error instanceof Error ? error.message : "Could not draft an event.";
    return Response.json({ error: message }, { status: 502 });
  }
}
