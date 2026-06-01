import { createClient } from "@supabase/supabase-js";
import {
  AI_RATE_LIMIT_MAX_REQUESTS,
  AI_RATE_LIMIT_WINDOW_MS,
  AI_TEXT_PROMPT_MAX_LENGTH,
} from "@/lib/aiLimits";

export {
  AI_RATE_LIMIT_MAX_REQUESTS,
  AI_RATE_LIMIT_WINDOW_MS,
  AI_TEXT_PROMPT_MAX_LENGTH,
};

type RateBucket = {
  count: number;
  windowStart: number;
};

const rateBuckets = new Map<string, RateBucket>();

export function normalizeAiTextPrompt(value: unknown) {
  const prompt = typeof value === "string" ? value.trim() : "";

  if (!prompt) {
    throw new Error("Add a short description of your plan.");
  }

  if (prompt.length > AI_TEXT_PROMPT_MAX_LENGTH) {
    throw new Error(
      `Keep the description under ${AI_TEXT_PROMPT_MAX_LENGTH} characters.`,
    );
  }

  return prompt;
}

export function checkAiRateLimit(
  userId: string,
  scope: string,
  now = Date.now(),
) {
  const key = `${scope}:${userId}`;
  const bucket = rateBuckets.get(key);

  if (!bucket || now - bucket.windowStart >= AI_RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= AI_RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(
        (AI_RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000,
      ),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function requireAuthenticatedUserId(request: Request) {
  const token = readBearerToken(request.headers.get("authorization"));

  if (!token) {
    return {
      response: Response.json(
        { error: "Sign in before using Smart Draft." },
        { status: 401 },
      ),
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      response: Response.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      ),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      response: Response.json(
        { error: "Sign in before using Smart Draft." },
        { status: 401 },
      ),
    };
  }

  return { userId: user.id };
}

function readBearerToken(value: string | null) {
  const match = value?.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() ?? "";
}
