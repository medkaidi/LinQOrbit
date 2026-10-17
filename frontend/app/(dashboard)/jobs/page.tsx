import type { Metadata } from "next";

import { PublicJobsView } from "@/features/job-offer/public-jobs-view";

export const metadata: Metadata = {
  title: "Browse offers — LinQOrbit",
  description: "Published job offers across LinQOrbit companies.",
};

export default function PublicJobsPage() {
  return <PublicJobsView />;
}
