import type { Metadata } from "next";
import { MarketingHome } from "@/features/marketing/home";

export const metadata: Metadata = {
  title: "LinQOrbit — AI-powered job matching",
  description:
    "Find your next professional trajectory: thousands of high-impact opportunities analyzed by your AI agents.",
};

export default function HomePage() {
  return <MarketingHome />;
}
