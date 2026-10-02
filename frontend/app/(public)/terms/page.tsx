import type { Metadata } from "next";
import { Terms } from "@/features/marketing/terms";

export const metadata: Metadata = {
  title: "Terms of use — LinQOrbit",
  description: "The rules that keep LinQOrbit fair for everyone.",
};

export default function TermsPage() {
  return <Terms />;
}
