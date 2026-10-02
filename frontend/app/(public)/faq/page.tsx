import type { Metadata } from "next";
import { Faq } from "@/features/marketing/faq";

export const metadata: Metadata = {
  title: "FAQ — LinQOrbit",
  description: "Everything you might want to know about LinQOrbit before jumping in.",
};

export default function FaqPage() {
  return <Faq />;
}
