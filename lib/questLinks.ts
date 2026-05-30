export function getQuestIdFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const questId = params.get("quest")?.trim() ?? "";
  return questId || null;
}

export function buildQuestShareUrl(questId: string, href: string) {
  const url = new URL(href);
  url.searchParams.set("quest", questId);
  return url.toString();
}
