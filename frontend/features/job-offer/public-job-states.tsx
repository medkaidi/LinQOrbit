import { Spinner } from "@/components/ui/spinner";

/**
 * État « offre introuvable » des vues publiques (candidature + fiche) —
 * même titre, même texte, même gabarit centré (TD-041).
 */
export function PublicJobNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl py-16 text-center">
      <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
        Job not found
      </h1>
      <p className="mt-3 text-body-md font-body-md text-text-secondary">
        This job offer does not exist, is no longer published, or has expired.
      </p>
    </div>
  );
}

/** État de chargement des vues publiques — même gabarit centré (TD-041). */
export function PublicJobLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl items-center gap-2 py-16 text-body-sm font-body-sm text-text-secondary">
      <Spinner />
      Loading…
    </div>
  );
}
