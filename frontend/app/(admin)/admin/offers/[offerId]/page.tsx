import type { Metadata } from "next";

import { AdminOfferDetailView } from "@/features/admin/admin-offer-view";

export const metadata: Metadata = {
  title: "Job offer — Administration — LinQOrbit",
  description: "Job offer details and normalized sheet for administrators.",
};

export default async function AdminOfferPage({
  params,
}: PageProps<"/admin/offers/[offerId]">) {
  const { offerId } = await params;
  return <AdminOfferDetailView offerId={offerId} />;
}
