export function formatRelativeTime(
  value: string | null,
  now = Date.now(),
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffMs = now - date.getTime();
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return "Now";
  }

  if (diffMs < hourMs) {
    return `${Math.round(diffMs / minuteMs)}m`;
  }

  if (diffMs < dayMs) {
    return `${Math.round(diffMs / hourMs)}h`;
  }

  return `${Math.round(diffMs / dayMs)}d`;
}
