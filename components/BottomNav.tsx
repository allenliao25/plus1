import { useState, type ReactNode } from "react";

export type AppTab = "home" | "explore" | "create" | "activity" | "profile";

type NavItem = {
  id: AppTab;
  label: string;
  icon: ReactNode;
};

const iconProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const navItems: NavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    id: "explore",
    label: "Explore",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
    ),
  },
  {
    id: "create",
    label: "Create",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
  },
  {
    id: "activity",
    label: "Activity",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M12 21s-7-4.35-9.5-8.5C.8 9.6 2.3 6 5.8 6c2 0 3.4 1.2 4.2 2.4C10.8 7.2 12.2 6 14.2 6c3.5 0 5 3.6 3.3 6.5C19 16.65 12 21 12 21Z" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7" />
      </svg>
    ),
  },
];

type BottomNavProps = {
  activeTab: AppTab;
  isDisabled?: boolean;
  profileAvatarInitials?: string;
  profileAvatarUrl?: string | null;
  unreadActivityCount?: number;
  onTabChange: (tab: AppTab) => void;
};

export default function BottomNav({
  activeTab,
  isDisabled = false,
  profileAvatarInitials = "",
  profileAvatarUrl = null,
  unreadActivityCount = 0,
  onTabChange,
}: BottomNavProps) {
  return (
    <nav
      aria-busy={isDisabled}
      className="relative z-20 flex shrink-0 touch-none transform-gpu select-none items-stretch justify-between border-t border-zinc-200 bg-white/85 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2.5 backdrop-blur-xl"
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        const isProfile = item.id === "profile";

        if (item.id === "create") {
          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onTabChange(item.id)}
              aria-label="Create"
              className="flex flex-1 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-zinc-950 text-white transition active:scale-95">
                {item.icon}
              </span>
            </button>
          );
        }

        const showBadge = item.id === "activity" && unreadActivityCount > 0;

        return (
          <button
            key={item.id}
            type="button"
            disabled={isDisabled}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`group relative flex min-h-11 flex-1 items-center justify-center rounded-2xl transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              isActive ? "text-zinc-950" : "text-zinc-300 hover:text-zinc-500"
            }`}
          >
            <span className="relative">
              {isProfile ? (
                <ProfileNavAvatar
                  key={profileAvatarUrl ?? profileAvatarInitials}
                  avatarInitials={profileAvatarInitials}
                  avatarUrl={profileAvatarUrl}
                  isActive={isActive}
                />
              ) : (
                item.icon
              )}
              {showBadge ? (
                <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold text-white">
                  {unreadActivityCount > 9 ? "9+" : unreadActivityCount}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function ProfileNavAvatar({
  avatarInitials,
  avatarUrl,
  isActive,
}: {
  avatarInitials: string;
  avatarUrl: string | null;
  isActive: boolean;
}) {
  const initials = avatarInitials.trim().slice(0, 2).toUpperCase() || "?";
  const [didImageFail, setDidImageFail] = useState(false);

  return (
    <span
      className={`grid h-8 w-8 place-items-center rounded-full border p-[2px] transition ${
        isActive
          ? "border-zinc-950"
          : "border-transparent group-hover:border-zinc-300"
      }`}
    >
      {avatarUrl && !didImageFail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          onError={() => setDidImageFail(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          className={`grid h-full w-full place-items-center rounded-full text-[0.68rem] font-bold ${
            isActive ? "bg-zinc-950 text-white" : "bg-zinc-200 text-zinc-600"
          }`}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
