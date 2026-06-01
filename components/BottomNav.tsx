import { useState } from "react";
import {
  CalendarDays,
  Home,
  Plus,
  UserRound,
  UsersRound,
  type LucideProps,
} from "lucide-react";

export type AppTab = "home" | "events" | "create" | "people" | "profile";

type NavItem = {
  id: AppTab;
  label: string;
  Icon: React.ComponentType<LucideProps>;
  filledWhenActive?: boolean;
};

const navItems: NavItem[] = [
  { id: "home", label: "Home", Icon: Home, filledWhenActive: true },
  { id: "events", label: "Events", Icon: CalendarDays },
  { id: "create", label: "Create", Icon: Plus },
  { id: "people", label: "People", Icon: UsersRound },
  { id: "profile", label: "Profile", Icon: UserRound },
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
  return (
    <nav
      aria-busy={isDisabled}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="mx-auto flex h-[49px] w-full max-w-[480px] items-center justify-around px-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isProfile = item.id === "profile";
          const { Icon } = item;

          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className="flex h-full min-w-0 flex-1 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isProfile ? (
                <ProfileNavAvatar
                  key={profileAvatarUrl ?? profileAvatarInitials}
                  avatarInitials={profileAvatarInitials}
                  avatarUrl={profileAvatarUrl}
                  isActive={isActive}
                />
              ) : (
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
                  aria-hidden="true"
                  className={
                    isActive
                      ? "text-zinc-950"
                      : "text-zinc-950 opacity-60"
                  }
                  {...(item.filledWhenActive && isActive
                    ? { fill: "currentColor" }
                    : {})}
                />
              )}
            </button>
          );
        })}
      </div>
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
      className={`block h-[26px] w-[26px] shrink-0 overflow-hidden rounded-full bg-zinc-200 transition ${
        isActive ? "ring-2 ring-zinc-950 ring-offset-1" : "opacity-60"
      }`}
    >
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
          className={`grid h-full w-full place-items-center text-[0.6rem] font-bold ${
            isActive ? "bg-zinc-950 text-white" : "bg-zinc-200 text-zinc-600"
          }`}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
