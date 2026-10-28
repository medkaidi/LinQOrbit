import type { Metadata } from "next";

import { PublicJobView } from "@/features/job-offer/public-job-view";

export const metadata: Metadata = {
  title: "Job offer — LinQOrbit",
  description: "A published job offer on LinQOrbit.",
};

/**
 * Fiche publique d'une offre dans la vitrine publique (D100/T-113) : même
 * article que la fiche du board authentifié, mais les liens internes restent
 * dans la vitrine (`/public/jobs`) et le CTA « Apply » mène au parcours de
 * candidature, qui reste authentifié.
 */
export default async function PublicJobPage({ params }: PageProps<"/public/jobs/[job]">) {
  const { job } = await params;
  return (
    <PublicJobView jobParam={job} backHref="/public/jobs" basePath="/public/jobs" />
  );
}
