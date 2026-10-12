import type { Metadata } from "next";

import { RecruiterWorkspace } from "@/features/recruiter/recruiter-workspace";

export const metadata: Metadata = {
  title: "Recruiter workspace — LinQOrbit",
  description: "Job offers, companies and recruiter identity on LinQOrbit.",
};

export default function RecruiterPage() {
  return <RecruiterWorkspace />;
}
