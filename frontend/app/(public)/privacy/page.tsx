import type { Metadata } from "next";
import { Privacy } from "@/features/marketing/privacy";

export const metadata: Metadata = {
  title: "Privacy notice — LinQOrbit",
  description: "How LinQOrbit handles your personal data — your data stays yours.",
};

export default function PrivacyPage() {
  return <Privacy />;
}
