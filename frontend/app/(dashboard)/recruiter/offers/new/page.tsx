import type { Metadata } from "next";

import { JobOfferNew } from "@/features/job-offer/job-offer-new";

export const metadata: Metadata = {
  title: "New job offer — LinQOrbit",
  description: "Create a job offer for your company.",
};

export default function NewJobOfferPage() {
  return <JobOfferNew />;
}
