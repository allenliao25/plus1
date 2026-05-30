import { requestQuestDraft } from "@/lib/aiQuestDraft";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let prompt = "";
  try {
    const body = (await request.json()) as { prompt?: unknown };
    prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!prompt) {
    return Response.json(
      { error: "Add a short description of your plan." },
      { status: 400 },
    );
  }

  try {
    const draft = await requestQuestDraft(prompt);
    return Response.json({ draft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not draft a quest.";
    return Response.json({ error: message }, { status: 502 });
  }
}
