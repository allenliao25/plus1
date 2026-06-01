import type { Quest } from "@/types/quest";

export type ProfileEventStats = {
  hosted: Quest[];
  attended: Quest[];
  events: Quest[];
};

export function getProfileEventStats(
  quests: Quest[],
  profileId: string,
  options: { includeCurrentUserFlags?: boolean } = {},
): ProfileEventStats {
  const hosted = quests.filter((quest) =>
    isHostedByProfile(quest, profileId, options.includeCurrentUserFlags),
  );
  const attended = quests.filter((quest) => {
    if (isHostedByProfile(quest, profileId, options.includeCurrentUserFlags)) {
      return false;
    }

    return (
      quest.attendees.some(
        (attendee) => attendee.id === profileId && !attendee.isHost,
      ) ||
      Boolean(options.includeCurrentUserFlags && quest.joinedByCurrentUser)
    );
  });

  return {
    hosted,
    attended,
    events: quests,
  };
}

function isHostedByProfile(
  quest: Quest,
  profileId: string,
  includeCurrentUserFlags = false,
) {
  return (
    quest.creatorId === profileId ||
    Boolean(includeCurrentUserFlags && quest.createdByCurrentUser)
  );
}
