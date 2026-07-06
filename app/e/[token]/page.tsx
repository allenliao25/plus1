import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import { formatCapacitySummary } from "@/lib/questCapacity";
import { getSiteOrigin } from "@/lib/questLinks";
import { fetchPublicQuestShare } from "@/lib/questShareService";
import { sharePalettes } from "@/app/e/[token]/sharePreviewStyles";
import GuestRsvp from "@/app/e/[token]/GuestRsvp";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const share = await fetchPublicQuestShare(token).catch(() => null);
  const siteOrigin = getSiteOrigin();
  const pageUrl = `${siteOrigin}/e/${encodeURIComponent(token)}`;
  const imageUrl = `${pageUrl}/opengraph-image`;

  if (!share) {
    return {
      title: "Event unavailable · plus1",
      description: "This plus1 event link is no longer available.",
      metadataBase: new URL(siteOrigin),
      openGraph: {
        title: "Event unavailable · plus1",
        description: "This plus1 event link is no longer available.",
        url: pageUrl,
        siteName: "plus1",
      },
    };
  }

  const description = `${share.category} at ${share.location} · ${share.startTime}`;

  return {
    title: `${share.title} · plus1`,
    description,
    metadataBase: new URL(siteOrigin),
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: share.title,
      description,
      url: pageUrl,
      siteName: "plus1",
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${share.title} on plus1`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: share.title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const share = await fetchPublicQuestShare(token).catch(() => null);

  if (!share) {
    return (
      <main className="min-h-lvh overflow-y-auto bg-zinc-50 px-5 py-8 text-zinc-950">
        <section className="mx-auto flex min-h-[70vh] max-w-[28rem] flex-col justify-center">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-zinc-400">
              plus1
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
              Event unavailable
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              This event link may have been revoked, removed, or mistyped.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-extrabold text-white"
            >
              Open plus1
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const palette = sharePalettes[share.category];
  const joinHref = `/?quest=${encodeURIComponent(share.questId)}`;
  const spotsLabel = formatCapacitySummary(share);
  const isFull =
    share.maxPeople !== null && share.goingCount >= share.maxPeople;
  const rsvpDisabledReason =
    share.status === "closed"
      ? "The host closed this event."
      : share.status === "past"
        ? "This event has already started."
        : isFull
          ? "This event is full."
          : null;

  return (
    <main className="min-h-lvh overflow-y-auto bg-[#f7f7f5] p-5 text-zinc-950">
      <section className="mx-auto flex min-h-[calc(100lvh-2.5rem)] max-w-[28rem] flex-col justify-center gap-4">
        <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.12)]">
          <div
            data-category={share.category}
            className="holo-thumb relative aspect-[16/10] overflow-hidden bg-zinc-950"
          >
            {share.cardImageUrl ? (
              <SafeImage
                src={share.cardImageUrl}
                alt=""
                fill
                sizes="448px"
                className="object-cover"
              />
            ) : (
              <QuestCategoryArtwork
                category={share.category}
                className="absolute inset-0 h-full w-full"
              />
            )}
            <div className="absolute inset-0 bg-black/15" />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/76 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/76">
                {share.category}
              </p>
              <h1 className="mt-1 text-3xl font-extrabold leading-[0.96] tracking-tight [text-shadow:0_3px_18px_rgba(0,0,0,0.5)]">
                {share.title}
              </h1>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-extrabold text-zinc-700">
                {visibilityLabel(share.visibility)}
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-extrabold"
                style={{ background: palette.pale, color: palette.dark }}
              >
                {share.status === "open" ? "Open" : statusLabel(share.status)}
              </span>
            </div>

            <div className="grid gap-2">
              <Fact icon={<MapPin size={17} />} label="Where" value={share.location} />
              <Fact
                icon={<CalendarDays size={17} />}
                label="When"
                value={share.startTimeRelative ?? share.startTime}
              />
              <Fact
                icon={<Users size={17} />}
                label="Spots"
                value={spotsLabel}
              />
            </div>

            <p className="text-sm leading-6 text-zinc-600">
              {share.description}
            </p>

            <div className="rounded-2xl bg-zinc-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-zinc-400">
                Hosted by
              </p>
              <p className="mt-1 text-sm font-extrabold text-zinc-950">
                {share.hostDisplayName}
                {share.hostHandle ? (
                  <span className="font-semibold text-zinc-500">
                    {" "}
                    @{share.hostHandle}
                  </span>
                ) : null}
              </p>
            </div>

            <GuestRsvp
              token={share.token}
              questTitle={share.title}
              goingCount={share.goingCount}
              canRsvp={rsvpDisabledReason === null}
              disabledReason={rsvpDisabledReason}
              accent={{
                base: palette.base,
                dark: palette.dark,
                pale: palette.pale,
              }}
            />

            <Link
              href={joinHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-extrabold text-zinc-700 transition hover:bg-zinc-50"
            >
              Have the app? Open in plus1
            </Link>
          </div>
        </div>

        <p className="text-center text-xs font-semibold leading-5 text-zinc-500">
          Viewing from Android or desktop? plus1 works in your browser too.
        </p>
      </section>
    </main>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[2.25rem_1fr] items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
      <span className="grid size-9 place-items-center rounded-full bg-zinc-100 text-zinc-700">
        {icon}
      </span>
      <span>
        <span className="block text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-zinc-400">
          {label}
        </span>
        <span className="block text-sm font-extrabold text-zinc-950">
          {value}
        </span>
      </span>
    </div>
  );
}

function visibilityLabel(visibility: string) {
  if (visibility === "invite_only") {
    return "Invite-only";
  }

  if (visibility === "friends") {
    return "Friends";
  }

  return "Local";
}

function statusLabel(status: string) {
  if (status === "closed") {
    return "Closed";
  }

  if (status === "past") {
    return "Past";
  }

  return "Open";
}
