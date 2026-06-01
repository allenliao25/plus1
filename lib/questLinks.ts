export function getQuestIdFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const questId = params.get("quest")?.trim() ?? "";
  const uuidMatch = questId.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );

  if (uuidMatch) {
    return uuidMatch[0];
  }

  return questId.split(/\s+/)[0] || null;
}

export function buildQuestShareUrl(questId: string, href: string) {
  const url = new URL(href);
  url.searchParams.set("quest", questId);
  return url.toString();
}

export function buildPublicQuestShareUrl(token: string, originOrHref?: string | null) {
  const origin = getSiteOrigin(originOrHref);
  return `${origin}/e/${encodeURIComponent(token)}`;
}

export function getSiteOrigin(originOrHref?: string | null) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin);
  }

  if (originOrHref) {
    return normalizeOrigin(originOrHref);
  }

  return "https://plus1-livid.vercel.app";
}

function normalizeOrigin(value: string) {
  const url = new URL(value);
  return url.origin;
}
