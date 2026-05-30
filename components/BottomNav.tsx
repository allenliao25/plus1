export type AppTab = "feed" | "create" | "mine";

const navItems: { id: AppTab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "create", label: "Create" },
  { id: "mine", label: "My quests" },
];

type BottomNavProps = {
  activeTab: AppTab;
  isDisabled?: boolean;
  onTabChange: (tab: AppTab) => void;
};

export default function BottomNav({
  activeTab,
  isDisabled = false,
  onTabChange,
}: BottomNavProps) {
  return (
    <nav
      aria-busy={isDisabled}
      className="grid grid-cols-3 gap-2 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3"
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            disabled={isDisabled}
            onClick={() => onTabChange(item.id)}
            className={`min-h-11 rounded-2xl px-3 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isActive
                ? "bg-zinc-950 text-white"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
