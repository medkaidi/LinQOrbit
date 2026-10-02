import type { Metadata } from "next";
import { HowItWorks } from "@/features/marketing/how-it-works";

export const metadata: Metadata = {
  title: "How it works — LinQOrbit",
  description: "From profile to offer in four steps, powered by AI agents that never sleep.",
};

export default function HowItWorksPage() {
  return <HowItWorks />;
}
