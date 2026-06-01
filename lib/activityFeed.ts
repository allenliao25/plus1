import type { ActivityEvent } from "@/types/quest";

export type ActivityFeedSection = {
  title: string;
  events: ActivityEvent[];
};

export type ActivityLine = {
  actorHandle: string | null;
  action: string;
  detail: string | null;
};

export function groupActivityEvents(
  events: ActivityEvent[],
  now: Date = new Date(),
): ActivityFeedSection[] {
  const sections = new Map<string, ActivityEvent[]>();

  for (const event of events) {
    const title = getActivitySectionTitle(event.createdAtISO, now);
    sections.set(title, [...(sections.get(title) ?? []), event]);
  }

  return [...sections.entries()].map(([title, sectionEvents]) => ({
    title,
    events: sectionEvents,
  }));
}

export function buildActivityLine(event: ActivityEvent): ActivityLine {
  const actorHandle = event.actor ? `@${event.actor.handle}` : null;
  const eventTitle = event.quest?.title ?? extractFallbackEventTitle(event.title);

  if (event.type === "friend_request") {
    const isPending = event.friendRequest?.status === "pending";

    return {
      actorHandle,
      action: "sent you a friend request.",
      detail: isPending ? event.body : (event.body ?? "This request is no longer pending."),
    };
  }

  if (event.type === "friend_accept") {
    return {
      actorHandle,
      action: "accepted your friend request.",
      detail: event.body,
    };
  }

  if (event.type === "reminder") {
    return {
      actorHandle: null,
      action: `${eventTitle} starts soon.`,
      detail: event.body,
    };
  }

  if (event.type === "invite") {
    return {
      actorHandle,
      action: `invited you to ${eventTitle}.`,
      detail: event.body,
    };
  }

  if (event.type === "join") {
    return {
      actorHandle,
      action: `joined your event${eventTitle ? `: ${eventTitle}` : ""}.`,
      detail: event.body,
    };
  }

  if (event.type === "edit") {
    return {
      actorHandle,
      action: `updated ${eventTitle}.`,
      detail: event.body,
    };
  }

  if (event.type === "close") {
    return {
      actorHandle,
      action: `closed ${eventTitle}.`,
      detail: event.body,
    };
  }

  return {
    actorHandle,
    action: event.title,
    detail: event.body,
  };
}

function getActivitySectionTitle(value: string | null, now: Date) {
  if (!value) {
    return "Last 7 days";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Last 7 days";
  }

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfEventDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfEventDay.getTime()) / dayMs,
  );

  if (dayDiff <= 0) {
    return "Today";
  }

  if (dayDiff === 1) {
    return "Yesterday";
  }

  if (dayDiff < 7) {
    return "Last 7 days";
  }

  return "Earlier";
}

function extractFallbackEventTitle(title: string) {
  const patterns = [
    /^You were invited to\s+/i,
    /\s+joined\s+/i,
    /\s+was updated$/i,
    /\s+was closed$/i,
    /\s+starts soon$/i,
  ];
  let nextTitle = title.trim();

  for (const pattern of patterns) {
    nextTitle = nextTitle.replace(pattern, "");
  }

  return nextTitle || title;
}
