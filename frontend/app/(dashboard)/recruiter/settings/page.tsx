import type { Metadata } from "next";

import { RecruiterSettings } from "@/features/recruiter/recruiter-workspace";

export const metadata: Metadata = {
  title: "Recruiter settings — LinQOrbit",
  description: "Recruiter profile and companies on LinQOrbit.",
};

export default function RecruiterSettingsPage() {
  return <RecruiterSettings />;
}
