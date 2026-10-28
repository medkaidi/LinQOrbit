import type { Metadata } from "next";

import { PublicJobsDirectory } from "@/features/marketing/public-jobs-directory";

export const metadata: Metadata = {
  title: "Browse job offers — LinQOrbit",
  description:
    "Published job offers on LinQOrbit: search by title or company, filter and sort — no account required.",
};

/**
 * Vitrine publique des offres (D100/T-113) : consultable sans compte, dans le
 * shell public. La recherche initiale arrive par `?q=` (le hero de l'accueil
 * y mène) ; la clé remonte la vue quand elle change pour que la saisie
 * courante reprenne la nouvelle recherche.
 */
export default async function PublicJobsPage({ searchParams }: PageProps<"/public/jobs">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  return <PublicJobsDirectory key={q} initialQuery={q} />;
}
