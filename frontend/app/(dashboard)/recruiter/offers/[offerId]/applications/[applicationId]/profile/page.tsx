import type { Metadata } from "next";

import { RecruiterApplicationProfileView } from "@/features/application/recruiter-application-profile-view";

export const metadata: Metadata = {
  title: "Candidate profile — LinQOrbit",
  description: "Full candidate profile of an application, with contact details.",
};

export default async function RecruiterApplicationProfilePage({
  params,
}: PageProps<"/recruiter/offers/[offerId]/applications/[applicationId]/profile">) {
  const { offerId, applicationId } = await params;
  return (
    <RecruiterApplicationProfileView offerId={offerId} applicationId={applicationId} />
  );
}
