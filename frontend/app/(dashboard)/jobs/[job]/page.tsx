import type { Metadata } from "next";

import { PublicJobView } from "@/features/job-offer/public-job-view";

export const metadata: Metadata = {
  title: "Job offer — LinQOrbit",
  description: "A published job offer on LinQOrbit.",
};

export default async function PublicJobPage({ params }: PageProps<"/jobs/[job]">) {
  const { job } = await params;
  return <PublicJobView jobParam={job} />;
}
