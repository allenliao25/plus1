import type { ReactNode } from "react";

export type AppTab = "home" | "explore" | "create" | "activity" | "profile";

type NavItem = {
  id: AppTab;
  label: string;
  icon: ReactNode;
};

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
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
  unreadActivityCount?: number;
  onTabChange: (tab: AppTab) => void;
};

export default function BottomNav({
  activeTab,
  isDisabled = false,
  unreadActivityCount = 0,
  onTabChange,
}: BottomNavProps) {
  return (
    <nav
      aria-busy={isDisabled}
      className="flex items-stretch justify-between border-t border-zinc-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-2"
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;

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
              <span
                className={`grid h-12 w-12 place-items-center rounded-2xl shadow-sm transition ${
                  isActive
                    ? "bg-zinc-950 text-white"
                    : "bg-zinc-950 text-white hover:bg-zinc-800"
                }`}
              >
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
            className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[0.65rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isActive
                ? "text-zinc-950"
                : "text-zinc-400 hover:text-zinc-700"
            }`}
          >
            <span className="relative">
              {item.icon}
              {showBadge ? (
                <span className="absolute -right-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold text-white">
                  {unreadActivityCount > 9 ? "9+" : unreadActivityCount}
                </span>
              ) : null}
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
