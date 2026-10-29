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
 *
 * Le conteneur de colonne est posé **ici**, pas dans `PublicJobArticle` :
 * l'article est partagé avec la fiche authentifiée `/jobs/[job]` (paddingée
 * par son shell dashboard), la prévisualisation recruteur et le bandeau
 * « Apply » replié — seul le shell public a besoin de sa propre gouttière.
 * `max-w-7xl mx-auto px-gutter` = la colonne du header, du footer et de la
 * liste `/public/jobs` ; `py-7` dégage les actions du haut de la barre
 * publique (le `main` public ne fait que `pt-16`, soit la hauteur exacte du
 * header).
 */
export default async function PublicJobPage({ params }: PageProps<"/public/jobs/[job]">) {
  const { job } = await params;
  return (
    <div className="max-w-7xl mx-auto px-gutter py-7">
      <PublicJobView jobParam={job} backHref="/public/jobs" basePath="/public/jobs" />
    </div>
  );
}
