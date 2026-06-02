import { useState } from "react";
import {
  CalendarDays,
  Home,
  Plus,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import SafeImage from "@/components/SafeImage";

export type AppTab = "home" | "events" | "create" | "people" | "profile";

const ICON_SIZE = 22;
const ICON_STROKE = 2;

type NavItem = {
  id: AppTab;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
  },
  {
    id: "events",
    label: "Events",
    icon: CalendarDays,
  },
  {
    id: "create",
    label: "Create",
    icon: Plus,
  },
  {
    id: "people",
    label: "People",
    icon: UsersRound,
  },
  {
    id: "profile",
    label: "Profile",
    icon: UserRound,
  },
];

type BottomNavProps = {
  activeTab: AppTab;
  homeUnreadCount?: number;
  isDisabled?: boolean;
  profileAvatarInitials?: string;
  profileAvatarUrl?: string | null;
  onTabChange: (tab: AppTab) => void;
};

export default function BottomNav({
  activeTab,
  homeUnreadCount = 0,
  isDisabled = false,
  profileAvatarInitials = "",
  profileAvatarUrl = null,
  onTabChange,
}: BottomNavProps) {
  const activeNavIndex = navItems.findIndex((item) => item.id === activeTab);
  const shouldShowActiveMarker = activeTab !== "create" && activeNavIndex >= 0;

  return (
    <nav
      aria-busy={isDisabled}
      className="bottom-nav-bar fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0px)] z-40 mx-auto flex w-[calc(100%-1.5rem)] max-w-[456px] shrink-0 touch-none transform-gpu select-none items-stretch justify-between rounded-[1.65rem] border p-2"
    >
      {shouldShowActiveMarker ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-2 top-2 w-[calc((100%_-_1rem)/5)] rounded-2xl bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_8px_18px_rgba(15,23,42,0.09)] ring-1 ring-zinc-200/70 backdrop-blur-xl transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${activeNavIndex * 100}%)` }}
        />
      ) : null}
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        const isProfile = item.id === "profile";
        const Icon = item.icon;

        if (item.id === "create") {
          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onTabChange(item.id)}
              aria-label="Create"
              className="relative z-10 flex flex-1 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="bottom-nav-create grid size-10 place-items-center rounded-2xl text-white ring-1 ring-white/50 transition active:scale-95">
                <Icon
                  size={ICON_SIZE}
                  strokeWidth={2.2}
                  fill="none"
                  aria-hidden="true"
                />
              </span>
            </button>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            disabled={isDisabled}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`group relative z-10 flex min-h-11 flex-1 items-center justify-center rounded-2xl transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              isActive
                ? "text-zinc-950"
                : "text-zinc-600 hover:bg-white/56 hover:text-zinc-950"
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
                <>
                  <Icon
                    size={ICON_SIZE}
                    strokeWidth={ICON_STROKE}
                    fill="none"
                    aria-hidden="true"
                  />
                  {item.id === "home" && homeUnreadCount > 0 ? (
                    <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[0.58rem] font-extrabold leading-none text-white ring-2 ring-white">
                      {homeUnreadCount > 9 ? "9+" : homeUnreadCount}
                    </span>
                  ) : null}
                </>
              )}
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
      className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border p-[2px] transition ${
        isActive
          ? "border-zinc-950"
          : "border-zinc-300/70 group-hover:border-zinc-500"
      }`}
    >
      <span className="block aspect-square h-full w-full overflow-hidden rounded-full bg-zinc-200">
        {avatarUrl && !didImageFail ? (
          <SafeImage
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            onError={() => setDidImageFail(true)}
            className="block h-full w-full object-cover"
          />
        ) : (
          <span
            className={`grid h-full w-full place-items-center text-[0.62rem] font-bold ${
              isActive ? "bg-zinc-950 text-white" : "bg-zinc-200 text-zinc-700"
            }`}
          >
            {initials}
          </span>
        )}
      </span>
    </span>
  );
}
