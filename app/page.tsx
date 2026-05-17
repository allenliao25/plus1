"use client";

import { FormEvent, useMemo, useState } from "react";

type Tab = "feed" | "create" | "matches";
type Vibe = "food" | "study" | "chaotic" | "casual" | "adventure";
type Visibility = "friends" | "nearby" | "campus";

type SideQuest = {
  id: number;
  title: string;
  location: string;
  when: string;
  vibe: Vibe;
  visibility: Visibility;
  people: string[];
  note: string;
};

type Suggestion = {
  name: string;
  why: string;
  context: string;
};

const starterQuests: SideQuest[] = [
  {
    id: 1,
    title: "Wilbur dinner in 15?",
    location: "Wilbur Dining",
    when: "next 20 min",
    vibe: "food",
    visibility: "campus",
    people: ["Maya", "Theo", "Jules"],
    note: "low stakes tray table energy",
  },
  {
    id: 2,
    title: "3am Safeway run",
    location: "El Camino Safeway",
    when: "tonight, maybe soon",
    vibe: "chaotic",
    visibility: "friends",
    people: ["Nina", "Cal"],
    note: "snacks, beverages, questionable decisions",
  },
  {
    id: 3,
    title: "Study at Green",
    location: "Green Library, 2nd floor",
    when: "7:30-9",
    vibe: "study",
    visibility: "nearby",
    people: ["Sam", "Ari", "Dev", "Lena"],
    note: "quiet table, mild accountability",
  },
  {
    id: 4,
    title: "Quick campus walk",
    location: "Meet at Main Quad",
    when: "after section",
    vibe: "casual",
    visibility: "nearby",
    people: ["Iris"],
    note: "walk and decompress before dinner",
  },
  {
    id: 5,
    title: "Boba after class?",
    location: "Tea Era",
    when: "4:10ish",
    vibe: "food",
    visibility: "campus",
    people: ["Kai", "Mina"],
    note: "quick escape from lecture brain",
  },
];

const suggestions: Suggestion[] = [
  {
    name: "Maya",
    why: "Usually says yes to food side quests and is already nearby.",
    context: "left chem lab 8 min ago",
  },
  {
    name: "Theo",
    why: "Free for the next hour and has been reacting to dining hall plans.",
    context: "in Stern lounge",
  },
  {
    name: "Jules",
    why: "You two both saved this spot and hang out most on weeknights.",
    context: "walking back from class",
  },
];

const vibeOptions: Vibe[] = ["food", "study", "chaotic", "casual", "adventure"];
const visibilityOptions: Visibility[] = ["friends", "nearby", "campus"];

const vibeStyles: Record<Vibe, string> = {
  food: "border-amber-200 bg-amber-100 text-amber-800",
  study: "border-sky-200 bg-sky-100 text-sky-800",
  chaotic: "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-800",
  casual: "border-emerald-200 bg-emerald-100 text-emerald-800",
  adventure: "border-violet-200 bg-violet-100 text-violet-800",
};

const tabLabels: Record<Tab, string> = {
  feed: "Feed",
  create: "Create",
  matches: "Matches",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function inviteMessage(quest: SideQuest) {
  const start = quest.when.includes("15") ? "in 15" : quest.when;
  return `yo I'm heading to ${quest.location} ${start} if you wanna pull up`;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [quests, setQuests] = useState(starterQuests);
  const [selectedQuestId, setSelectedQuestId] = useState(starterQuests[0].id);
  const [invited, setInvited] = useState<string[]>([]);
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    title: "",
    location: "",
    when: "",
    vibe: "food" as Vibe,
    visibility: "friends" as Visibility,
  });

  const selectedQuest = useMemo(
    () => quests.find((quest) => quest.id === selectedQuestId) ?? quests[0],
    [quests, selectedQuestId],
  );

  function handleDown(quest: SideQuest) {
    setQuests((current) =>
      current.map((item) =>
        item.id === quest.id && !item.people.includes("You")
          ? { ...item, people: ["You", ...item.people] }
          : item,
      ),
    );
    setSelectedQuestId(quest.id);
    setSuccess(`You're down for ${quest.title}`);
    setActiveTab("matches");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || !form.location.trim() || !form.when.trim()) {
      setSuccess("Add the plan, place, and timing first.");
      return;
    }

    const newQuest: SideQuest = {
      id: Date.now(),
      title: form.title.trim(),
      location: form.location.trim(),
      when: form.when.trim(),
      vibe: form.vibe,
      visibility: form.visibility,
      people: ["You"],
      note: "fresh side quest, waiting for the first plus1",
    };

    setQuests((current) => [newQuest, ...current]);
    setSelectedQuestId(newQuest.id);
    setInvited([]);
    setSuccess("Posted. Now pick who should get the nudge.");
    setForm({
      title: "",
      location: "",
      when: "",
      vibe: "food",
      visibility: "friends",
    });
    setActiveTab("matches");
  }

  function handleInvite(name: string) {
    setInvited((current) =>
      current.includes(name) ? current : [...current, name],
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-5 text-zinc-950 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[430px] flex-col overflow-hidden rounded-[2rem] border border-black/10 bg-[#fbfaf7] shadow-2xl shadow-zinc-900/15">
        <div className="flex items-center justify-between border-b border-black/10 bg-[#fffdf8]/95 px-5 py-4">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-zinc-500">
              do anything with someone
            </p>
            <h1 className="text-3xl font-black tracking-tight">plus1</h1>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800"
          >
            new quest
          </button>
        </div>

        {success ? (
          <div className="mx-5 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            {success}
          </div>
        ) : null}

        <div
          key={activeTab}
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-4"
        >
          {activeTab === "feed" ? (
            <Feed quests={quests} onDown={handleDown} onOpenMatches={setSelectedQuestId} />
          ) : null}

          {activeTab === "create" ? (
            <CreateQuest
              form={form}
              setForm={setForm}
              onSubmit={handleSubmit}
            />
          ) : null}

          {activeTab === "matches" ? (
            <Matches
              quest={selectedQuest}
              invited={invited}
              onInvite={handleInvite}
            />
          ) : null}
        </div>

        <nav className="grid grid-cols-3 border-t border-black/10 bg-[#fffdf8]/95 p-3">
          {(Object.keys(tabLabels) as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`mx-1 rounded-2xl px-3 py-3 text-sm font-black transition ${
                activeTab === tab
                  ? "bg-zinc-950 text-white shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}

function Feed({
  quests,
  onDown,
  onOpenMatches,
}: {
  quests: SideQuest[];
  onDown: (quest: SideQuest) => void;
  onOpenMatches: (questId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">nearby now</h2>
          <p className="text-sm font-medium text-zinc-500">
            tiny plans that need one more person
          </p>
        </div>
        <span className="rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-lime-950">
          live
        </span>
      </div>

      {quests.map((quest) => (
        <article
          key={quest.id}
          className="rounded-[1.35rem] border border-black/10 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black leading-tight tracking-tight">
                {quest.title}
              </h3>
              <p className="mt-1 text-sm font-semibold text-zinc-500">
                {quest.location} · {quest.when}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${vibeStyles[quest.vibe]}`}
            >
              {quest.vibe}
            </span>
          </div>

          <p className="mt-3 text-sm font-medium text-zinc-600">{quest.note}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onOpenMatches(quest.id);
                onDown(quest);
              }}
              className="rounded-full bg-[#ff5b35] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#e64d2b]"
            >
              I&apos;m down
            </button>

            <div className="flex min-w-0 items-center justify-end">
              <div className="flex -space-x-2">
                {quest.people.slice(0, 4).map((person) => (
                  <div
                    key={person}
                    className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-zinc-950 text-[0.65rem] font-black text-white"
                    title={person}
                  >
                    {initials(person)}
                  </div>
                ))}
              </div>
              <span className="ml-2 text-xs font-black text-zinc-500">
                {quest.people.length} going
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CreateQuest({
  form,
  setForm,
  onSubmit,
}: {
  form: {
    title: string;
    location: string;
    when: string;
    vibe: Vibe;
    visibility: Visibility;
  };
  setForm: (form: {
    title: string;
    location: string;
    when: string;
    vibe: Vibe;
    visibility: Visibility;
  }) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h2 className="text-2xl font-black tracking-tight">drop a quest</h2>
        <p className="text-sm font-medium text-zinc-500">
          make the ask feel like knocking, not a group text
        </p>
      </div>

      <Field
        label="What are you doing?"
        value={form.title}
        placeholder="Wilbur dinner in 15?"
        onChange={(value) => setForm({ ...form, title: value })}
      />
      <Field
        label="Where?"
        value={form.location}
        placeholder="Wilbur Dining"
        onChange={(value) => setForm({ ...form, location: value })}
      />
      <Field
        label="When?"
        value={form.when}
        placeholder="next 20 min"
        onChange={(value) => setForm({ ...form, when: value })}
      />

      <OptionGroup
        label="Vibe"
        options={vibeOptions}
        value={form.vibe}
        onChange={(value) => setForm({ ...form, vibe: value as Vibe })}
      />

      <OptionGroup
        label="Visibility"
        options={visibilityOptions}
        value={form.visibility}
        onChange={(value) =>
          setForm({ ...form, visibility: value as Visibility })
        }
      />

      <button
        type="submit"
        className="w-full rounded-[1.15rem] bg-zinc-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-zinc-800"
      >
        Post side quest
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-zinc-700">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[1.15rem] border border-black/10 bg-white px-4 py-4 text-base font-bold outline-none transition placeholder:text-zinc-300 focus:border-zinc-950"
      />
    </label>
  );
}

function OptionGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-black text-zinc-700">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-3 py-2 text-sm font-black transition ${
              value === option
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-black/10 bg-white text-zinc-500 hover:text-zinc-950"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Matches({
  quest,
  invited,
  onInvite,
}: {
  quest: SideQuest;
  invited: string[];
  onInvite: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight">invite agent</h2>
        <p className="text-sm font-medium text-zinc-500">
          low effort nudges for the people most likely to say yes
        </p>
      </div>

      <section className="rounded-[1.35rem] border border-black/10 bg-zinc-950 p-4 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">
          message draft
        </p>
        <p className="mt-3 text-xl font-black leading-snug">
          &quot;{inviteMessage(quest)}&quot;
        </p>
        <p className="mt-3 text-sm font-semibold text-white/60">
          for {quest.title} · {quest.visibility}
        </p>
      </section>

      <div className="space-y-3">
        {suggestions.map((person) => {
          const isInvited = invited.includes(person.name);

          return (
            <article
              key={person.name}
              className="rounded-[1.35rem] border border-black/10 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ff5b35] text-sm font-black text-white">
                  {initials(person.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-black">{person.name}</h3>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
                      nearby
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-zinc-600">
                    {person.why}
                  </p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-400">
                    {person.context}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onInvite(person.name)}
                className={`mt-4 w-full rounded-full px-4 py-3 text-sm font-black transition ${
                  isInvited
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-zinc-950 text-white hover:bg-zinc-800"
                }`}
              >
                {isInvited ? "Invited" : "Invite"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
