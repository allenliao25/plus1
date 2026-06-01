import { useState, type ReactNode } from "react";
import { CalendarDays, Home, Plus, UserRound, UsersRound } from "lucide-react";

export type AppTab = "home" | "events" | "create" | "people" | "profile";

type NavItem = {
  id: AppTab;
  label: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: <Home size={25} strokeWidth={2.05} aria-hidden="true" />,
  },
  {
    id: "events",
    label: "Events",
    icon: <CalendarDays size={25} strokeWidth={2.05} aria-hidden="true" />,
  },
  {
    id: "create",
    label: "Create",
    icon: <Plus size={27} strokeWidth={2.25} aria-hidden="true" />,
  },
  {
    id: "people",
    label: "People",
    icon: <UsersRound size={25} strokeWidth={2.05} aria-hidden="true" />,
  },
  {
    id: "profile",
    label: "Profile",
    icon: <UserRound size={25} strokeWidth={2.05} aria-hidden="true" />,
  },
];

type BottomNavProps = {
  activeTab: AppTab;
  isDisabled?: boolean;
  profileAvatarInitials?: string;
  profileAvatarUrl?: string | null;
  onTabChange: (tab: AppTab) => void;
};

export default function BottomNav({
  activeTab,
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
      className="glass-bar fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+10px)] z-40 mx-auto flex w-[calc(100%-1.5rem)] max-w-[456px] shrink-0 touch-none transform-gpu select-none items-stretch justify-between rounded-[1.65rem] border px-2 py-2"
    >
      {shouldShowActiveMarker ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-2 top-2 w-[calc((100%_-_1rem)/5)] rounded-2xl bg-white/56 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_8px_20px_rgba(15,23,42,0.07)] transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${activeNavIndex * 100}%)` }}
        />
      ) : null}
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
              className="relative z-10 flex flex-1 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span
                className={`glass-ignite grid h-11 w-11 place-items-center rounded-2xl text-white shadow-[0_14px_30px_rgba(244,114,182,0.22)] ring-1 ring-white/40 transition active:scale-95 ${
                  isActive ? "scale-[1.03] ring-zinc-950/20" : ""
                }`}
              >
                {item.icon}
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
                : "text-zinc-400 hover:bg-white/34 hover:text-zinc-600"
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
      className={`grid aspect-square h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border p-[2px] transition ${
        isActive
          ? "border-zinc-950"
          : "border-transparent group-hover:border-zinc-300"
      }`}
    >
      <span className="block aspect-square h-full w-full overflow-hidden rounded-full bg-zinc-200">
        {avatarUrl && !didImageFail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            onError={() => setDidImageFail(true)}
            className="block h-full w-full object-cover"
          />
        ) : (
          <span
            className={`grid h-full w-full place-items-center text-[0.68rem] font-bold ${
              isActive ? "bg-zinc-950 text-white" : "bg-zinc-200 text-zinc-600"
            }`}
          >
            {initials}
          </span>
        )}
      </span>
    </span>
  );
}
