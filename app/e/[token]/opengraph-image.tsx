import { ImageResponse } from "next/og";
import { fetchPublicQuestShare } from "@/lib/questShareService";
import { sharePalettes } from "@/app/e/[token]/sharePreviewStyles";

type ImageProps = {
  params: Promise<{ token: string }>;
};

export const alt = "plus1 event";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Image({ params }: ImageProps) {
  const { token } = await params;
  const share = await fetchPublicQuestShare(token).catch(() => null);

  if (!share) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f7f7f5",
            color: "#18181b",
            fontFamily: "Arial",
          }}
        >
          <div
            style={{
              width: 760,
              height: 390,
              borderRadius: 52,
              background: "#ffffff",
              border: "1px solid #e4e4e7",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 56,
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 800, color: "#71717a" }}>
              plus1
            </div>
            <div style={{ marginTop: 24, fontSize: 72, fontWeight: 900 }}>
              Event unavailable
            </div>
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const palette = sharePalettes[share.category];
  const openSpots = Math.max(0, share.maxPeople - share.goingCount);
  const metaLabel = `${share.category} / ${visibilityLabel(share.visibility)}`;
  const spotsLabel = `${share.startTimeRelative || share.startTime} - ${share.goingCount}/${share.maxPeople} going - ${openSpots} open`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f5",
          color: "#111111",
          fontFamily: "Arial",
          padding: 56,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 44,
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 64,
            border: `6px solid ${palette.dark}`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                color: palette.dark,
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              {metaLabel}
            </div>
            <div
              style={{
                fontSize: 84,
                fontWeight: 900,
                letterSpacing: 0,
                lineHeight: 1,
              }}
            >
              {share.title}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 32,
                fontWeight: 700,
                color: "#3f3f46",
              }}
            >
              <div>{share.location}</div>
              <div>{spotsLabel}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 999,
                background: palette.dark,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 900,
              }}
            >
              +1
            </div>
            <div style={{ fontSize: 34, fontWeight: 900 }}>plus1</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#71717a" }}>
              Join on plus1
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
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
