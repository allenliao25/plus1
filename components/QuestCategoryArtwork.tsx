import type { SVGProps } from "react";
import type { QuestCategory } from "@/types/quest";

type QuestCategoryArtworkProps = SVGProps<SVGSVGElement> & {
  category: QuestCategory;
};

type Palette = {
  base: string;
  dark: string;
  mid: string;
  soft: string;
  pale: string;
};

const palettes: Record<QuestCategory, Palette> = {
  Fitness: {
    base: "#a3e635",
    dark: "#365314",
    mid: "#65a30d",
    soft: "#bef264",
    pale: "#ecfccb",
  },
  Social: {
    base: "#14b8a6",
    dark: "#134e4a",
    mid: "#0f766e",
    soft: "#5eead4",
    pale: "#ccfbf1",
  },
  Sidequest: {
    base: "#f43f5e",
    dark: "#881337",
    mid: "#be123c",
    soft: "#fb7185",
    pale: "#ffe4e6",
  },
  Other: {
    base: "#a855f7",
    dark: "#581c87",
    mid: "#7e22ce",
    soft: "#c084fc",
    pale: "#f3e8ff",
  },
  Study: {
    base: "#2563eb",
    dark: "#1e3a8a",
    mid: "#1d4ed8",
    soft: "#60a5fa",
    pale: "#dbeafe",
  },
  Food: {
    base: "#f97316",
    dark: "#7c2d12",
    mid: "#ea580c",
    soft: "#fdba74",
    pale: "#ffedd5",
  },
  Outdoors: {
    base: "#16a34a",
    dark: "#14532d",
    mid: "#15803d",
    soft: "#86efac",
    pale: "#dcfce7",
  },
};

export default function QuestCategoryArtwork({
  category,
  className = "",
  ...props
}: QuestCategoryArtworkProps) {
  const palette = palettes[category];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 180"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      {...props}
    >
      <rect width="240" height="180" fill={palette.base} />
      <circle cx="204" cy="28" r="42" fill={palette.pale} opacity="0.42" />
      <circle cx="38" cy="155" r="52" fill={palette.dark} opacity="0.13" />
      <path
        d="M-18 132c38-20 72-21 102-2 34 22 74 18 121-12 20-13 40-19 62-18v88H-18z"
        fill={palette.dark}
        opacity="0.15"
      />
      <CategoryShapes category={category} palette={palette} />
    </svg>
  );
}

function CategoryShapes({
  category,
  palette,
}: {
  category: QuestCategory;
  palette: Palette;
}) {
  if (category === "Fitness") {
    return <FitnessShapes palette={palette} />;
  }

  if (category === "Social") {
    return <SocialShapes palette={palette} />;
  }

  if (category === "Sidequest") {
    return <SidequestShapes palette={palette} />;
  }

  if (category === "Other") {
    return <OtherShapes palette={palette} />;
  }

  if (category === "Study") {
    return <StudyShapes palette={palette} />;
  }

  if (category === "Food") {
    return <FoodShapes palette={palette} />;
  }

  return <OutdoorsShapes palette={palette} />;
}

function FitnessShapes({ palette }: { palette: Palette }) {
  return (
    <g>
      <path
        d="M29 104h18v-12h14v42H47v-13H29zm182 0h-18v-12h-14v42h14v-13h18zM62 106h116v14H62z"
        fill={palette.dark}
        opacity="0.78"
      />
      <path
        d="M79 54h20l9 26H70zm11-14 9 14H80zM78 80h22v50H78z"
        fill={palette.mid}
        opacity="0.48"
      />
      <path
        d="M32 54h27l11 13 13-27 19 48 12-24h20"
        fill="none"
        stroke={palette.pale}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="8"
        opacity="0.72"
      />
      <path
        d="M154 51c18 8 29 20 34 37l-51 16c-4-16 2-35 17-53z"
        fill={palette.soft}
        opacity="0.58"
      />
      <circle cx="187" cy="127" r="19" fill={palette.dark} opacity="0.32" />
    </g>
  );
}

function SocialShapes({ palette }: { palette: Palette }) {
  return (
    <g>
      <path
        d="M36 43h92a18 18 0 0 1 18 18v28a18 18 0 0 1-18 18H82l-30 22 8-22H36a18 18 0 0 1-18-18V61a18 18 0 0 1 18-18z"
        fill={palette.pale}
        opacity="0.56"
      />
      <path
        d="M112 76h86a17 17 0 0 1 17 17v29a17 17 0 0 1-17 17h-22l8 20-29-20h-43a17 17 0 0 1-17-17V93a17 17 0 0 1 17-17z"
        fill={palette.dark}
        opacity="0.46"
      />
      <circle cx="63" cy="75" r="7" fill={palette.mid} />
      <circle cx="88" cy="75" r="7" fill={palette.mid} />
      <circle cx="113" cy="75" r="7" fill={palette.mid} />
      <path
        d="M52 147c17-22 45-23 63 0m9 0c17-22 45-23 63 0"
        fill="none"
        stroke={palette.pale}
        strokeLinecap="round"
        strokeWidth="8"
        opacity="0.68"
      />
      <path
        d="M47 144h147M118 36v14m-24-3 10 12m50-12-10 12"
        stroke={palette.dark}
        strokeLinecap="round"
        strokeWidth="7"
        opacity="0.28"
      />
    </g>
  );
}

function SidequestShapes({ palette }: { palette: Palette }) {
  return (
    <g>
      <path
        d="M52 128c19-34 45-53 79-56 25-2 45-13 61-33"
        fill="none"
        stroke={palette.dark}
        strokeLinecap="round"
        strokeWidth="14"
        opacity="0.52"
      />
      <path
        d="M57 126c18-26 40-40 67-43 30-4 54-18 72-43"
        fill="none"
        stroke={palette.pale}
        strokeLinecap="round"
        strokeWidth="6"
        opacity="0.74"
      />
      <path
        d="M38 101h54a21 21 0 0 1 21 21v10a21 21 0 0 1-21 21H38z"
        fill={palette.dark}
        opacity="0.68"
      />
      <path
        d="M57 119h24M69 107v24"
        stroke={palette.pale}
        strokeLinecap="round"
        strokeWidth="7"
      />
      <path
        d="M145 32h44l-10 33 22 8-50 60 12-42-25-8z"
        fill={palette.soft}
        opacity="0.68"
      />
      <path
        d="m39 44 6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2zm170 93 5 10 11 2-8 8 2 11-10-6-10 6 2-11-8-8 11-2z"
        fill={palette.pale}
        opacity="0.72"
      />
    </g>
  );
}

function OtherShapes({ palette }: { palette: Palette }) {
  return (
    <g>
      <path
        d="M58 74h54a27 27 0 0 1 27 27v20a19 19 0 0 1-32 14l-13-13H76l-13 13a19 19 0 0 1-32-14v-20a27 27 0 0 1 27-27z"
        fill={palette.dark}
        opacity="0.7"
      />
      <path
        d="M58 101h26M71 88v26m42-15h.1m19 0h.1"
        stroke={palette.pale}
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path
        d="M167 42h33v33h-33zm0 33 17 20 16-20"
        fill={palette.soft}
        opacity="0.56"
      />
      <path
        d="M181 132 196 99l15 33-15-7z"
        fill={palette.dark}
        opacity="0.42"
      />
      <path
        d="m39 38 7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2zm170 87 5 10 11 2-8 7 2 11-10-5-10 5 2-11-8-7 11-2z"
        fill={palette.pale}
        opacity="0.74"
      />
    </g>
  );
}

function StudyShapes({ palette }: { palette: Palette }) {
  return (
    <g>
      <path
        d="M37 58c31-12 55-9 74 9v76c-20-16-45-20-74-9zm166 0c-31-12-55-9-74 9v76c20-16 45-20 74-9z"
        fill={palette.pale}
        opacity="0.62"
      />
      <path d="M111 67h18v76h-18z" fill={palette.dark} opacity="0.32" />
      <path
        d="m119 28 67 25-67 25-67-25zM73 61v26"
        fill={palette.dark}
        opacity="0.58"
      />
      <path
        d="M73 87c8 5 13 12 13 22H60c0-10 5-17 13-22z"
        fill={palette.mid}
        opacity="0.58"
      />
      <path
        d="M158 91c0-13 10-23 23-23s23 10 23 23c0 8-4 15-11 19v12h-24v-12c-7-4-11-11-11-19zM169 135h24"
        fill={palette.soft}
        opacity="0.62"
      />
      <path
        d="M46 113h45m58 0h45M50 128h38m66 0h36"
        stroke={palette.mid}
        strokeLinecap="round"
        strokeWidth="5"
        opacity="0.62"
      />
    </g>
  );
}

function FoodShapes({ palette }: { palette: Palette }) {
  return (
    <g>
      <path
        d="M42 117a55 55 0 0 0 110 0z"
        fill={palette.dark}
        opacity="0.64"
      />
      <path d="M55 117h84" stroke={palette.pale} strokeLinecap="round" strokeWidth="9" />
      <path
        d="M67 83c-11-13 13-18 2-32m31 32c-11-13 13-18 2-32m31 32c-11-13 13-18 2-32"
        fill="none"
        stroke={palette.pale}
        strokeLinecap="round"
        strokeWidth="7"
        opacity="0.68"
      />
      <path
        d="M173 45c16 0 29 12 29 27v55h-58V72c0-15 13-27 29-27z"
        fill={palette.pale}
        opacity="0.58"
      />
      <path
        d="M144 84h58v21h-58zM184 105h18v48h-18zM143 105h18v48h-18z"
        fill={palette.dark}
        opacity="0.52"
      />
      <path
        d="M36 46c13-9 31-5 38 10 7 14 0 31-15 37-15 7-32 0-38-15-5-12 0-25 15-32z"
        fill={palette.soft}
        opacity="0.62"
      />
    </g>
  );
}

function OutdoorsShapes({ palette }: { palette: Palette }) {
  return (
    <g>
      <circle cx="191" cy="45" r="24" fill={palette.pale} opacity="0.72" />
      <path
        d="m9 139 59-78 39 53 28-38 80 63z"
        fill={palette.dark}
        opacity="0.62"
      />
      <path
        d="m68 61 18 25-19-8-18 8zm67 15 19 25-20-8-18 8z"
        fill={palette.pale}
        opacity="0.68"
      />
      <path
        d="M45 117h33l-16-29zm116 7h42l-21-39zM60 88v62m122-65v65"
        fill={palette.mid}
        opacity="0.62"
      />
      <path
        d="M93 146c8-23 46-23 54 0z"
        fill={palette.soft}
        opacity="0.62"
      />
      <path
        d="M120 111v35m-17-7h34"
        stroke={palette.dark}
        strokeLinecap="round"
        strokeWidth="6"
        opacity="0.52"
      />
    </g>
  );
}
