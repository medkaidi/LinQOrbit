import type { Metadata } from "next";

import { JobOfferPreview } from "@/features/job-offer/job-offer-preview";

export const metadata: Metadata = {
  title: "Preview job offer — LinQOrbit",
  description: "Preview a job offer exactly as it will look once published.",
};

export default async function PreviewJobOfferPage({
  params,
}: PageProps<"/recruiter/offers/[offerId]/preview">) {
  const { offerId } = await params;
  return <JobOfferPreview offerId={offerId} />;
}
