import type { Metadata } from "next";

import { SuggestedCandidatesView } from "@/features/invitation/suggested-candidates-view";

export const metadata: Metadata = {
  title: "Suggested candidates — LinQOrbit",
  description: "Candidates suggested for a job offer, ready to be invited.",
};

export default async function SuggestedCandidatesPage({
  params,
}: PageProps<"/recruiter/offers/[offerId]/suggestions">) {
  const { offerId } = await params;
  return <SuggestedCandidatesView offerId={offerId} />;
}
