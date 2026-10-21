import type { Metadata } from "next";

import { RecruiterApplicationsView } from "@/features/application/recruiter-applications-view";

export const metadata: Metadata = {
  title: "Applications — LinQOrbit",
  description: "Review applications received for a job offer.",
};

export default async function RecruiterApplicationsPage({
  params,
}: PageProps<"/recruiter/offers/[offerId]/applications">) {
  const { offerId } = await params;
  return <RecruiterApplicationsView offerId={offerId} />;
}
