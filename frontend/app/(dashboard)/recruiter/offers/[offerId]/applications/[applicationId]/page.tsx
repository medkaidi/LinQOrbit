import type { Metadata } from "next";

import { RecruiterApplicationDetailView } from "@/features/application/recruiter-application-detail-view";

export const metadata: Metadata = {
  title: "Application — LinQOrbit",
  description: "Review a candidate application and record a decision.",
};

export default async function RecruiterApplicationDetailPage({
  params,
}: PageProps<"/recruiter/offers/[offerId]/applications/[applicationId]">) {
  const { offerId, applicationId } = await params;
  return <RecruiterApplicationDetailView offerId={offerId} applicationId={applicationId} />;
}
