import type { Metadata } from "next";
import { Contact } from "@/features/marketing/contact";

export const metadata: Metadata = {
  title: "Contact — LinQOrbit",
  description: "Questions, feedback or partnerships — we usually reply within two business days.",
};

export default function ContactPage() {
  return <Contact />;
}
