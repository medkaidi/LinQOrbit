import type { Metadata } from "next";
import { HowItWorks } from "@/features/marketing/how-it-works";

export const metadata: Metadata = {
  title: "How it works — LinQOrbit",
  description:
    "From job brief to signed offer in four steps: how autonomous agents source, vet, and reach out.",
};

export default function HowItWorksPage() {
  return <HowItWorks />;
}
