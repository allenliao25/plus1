import { requestQuestDraft } from "@/lib/aiQuestDraft";
import {
  checkAiRateLimit,
  requireAuthenticatedUserId,
} from "@/lib/aiRequestGuards";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB upload cap

const EXTRACT_PROMPT =
  "Extract an event draft from this flyer image. Read the title, location, date/time, and any details, then map them to the required JSON fields.";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUserId(request);

  if ("response" in auth) {
    return auth.response;
  }

  const rateLimit = checkAiRateLimit(auth.userId, "flyer-to-quest");

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Smart Draft is busy. Try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": `${rateLimit.retryAfterSeconds}` },
      },
    );
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const value = formData.get("image");
    file = value instanceof File ? value : null;
  } catch {
    return Response.json(
      { error: "Expected a multipart form with an 'image' file." },
      { status: 400 },
    );
  }

  if (!file) {
    return Response.json({ error: "Attach a flyer image." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json(
      { error: "Uploaded file must be an image." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "Image is too large (max 8 MB)." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    const draft = await requestQuestDraft([
      { type: "text", text: EXTRACT_PROMPT },
      { type: "image_url", image_url: { url: dataUrl } },
    ]);

    return Response.json({ draft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read the flyer.";
    return Response.json({ error: message }, { status: 502 });
  }
}
