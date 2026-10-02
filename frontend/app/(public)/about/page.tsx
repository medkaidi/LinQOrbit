import type { Metadata } from "next";
import { About } from "@/features/marketing/about";

export const metadata: Metadata = {
  title: "About — LinQOrbit",
  description:
    "LinQOrbit pairs candidates and recruiters with AI agents that read the market continuously.",
};

export default function AboutPage() {
  return <About />;
}
