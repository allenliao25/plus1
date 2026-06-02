import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "plus1",
  description: "Find events with people nearby.",
};

export default function Home() {
  return <AppShell initialAiAvailable={Boolean(process.env.OPENAI_API_KEY)} />;
}
