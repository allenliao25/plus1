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
