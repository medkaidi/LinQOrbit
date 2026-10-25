import type { Metadata } from "next";

import { SuggestedCandidateProfileView } from "@/features/invitation/suggested-candidate-profile-view";

export const metadata: Metadata = {
  title: "Suggested candidate — LinQOrbit",
  description: "Full profile of a candidate who agreed to be visible to recruiters.",
};

export default async function SuggestedCandidateProfilePage({
  params,
}: PageProps<"/recruiter/offers/[offerId]/suggestions/[suggestionId]">) {
  const { offerId, suggestionId } = await params;
  return <SuggestedCandidateProfileView offerId={offerId} suggestionId={suggestionId} />;
}
