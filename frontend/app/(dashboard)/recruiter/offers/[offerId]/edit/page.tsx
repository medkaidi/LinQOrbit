import type { Metadata } from "next";

import { JobOfferEdit } from "@/features/job-offer/job-offer-edit";

export const metadata: Metadata = {
  title: "Edit job offer — LinQOrbit",
  description: "Edit a draft or validated job offer.",
};

export default async function EditJobOfferPage({
  params,
}: PageProps<"/recruiter/offers/[offerId]/edit">) {
  const { offerId } = await params;
  return <JobOfferEdit offerId={offerId} />;
}
