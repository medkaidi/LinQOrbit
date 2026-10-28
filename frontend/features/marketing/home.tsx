"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { OFFER_SEARCH_MAX_LENGTH } from "@/features/job-offer/offer-filter-controls";
import { OrbitIllustration } from "@/features/marketing/orbit-illustration";

/**
 * Page d'accueil publique : la recherche est **réelle** — elle mène à la
 * vitrine publique des offres (`/public/jobs?q=…`), consultable sans compte,
 * où le champ reprend la saisie (D99, D100/T-113).
 *
 * Le champ ne porte qu'un critère libre, celui que la recherche publique sait
 * faire : titre **ou** nom de société (`q` côté API, `OfferSearchPattern`).
 * Le placeholder le dit — ni les compétences ni le lieu ne sont cherchés : ce
 * serait promettre un filtre que le backend n'expose pas.
 */
export function MarketingHome() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = query.trim().slice(0, OFFER_SEARCH_MAX_LENGTH);
    router.push(q ? `/public/jobs?q=${encodeURIComponent(q)}` : "/public/jobs");
  };

  return (
    <div className="w-full bg-canvas-white">
      <section className="max-w-7xl mx-auto px-gutter pt-space-xl pb-space-lg flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-subtle border border-orange-subtle mb-space-sm">
          <span className="w-2 h-2 rounded-full bg-orange-vibrant animate-pulse motion-reduce:animate-none" />
          <span className="font-label-md text-label-md text-orange-deep font-semibold tracking-wide uppercase">
            LinQ Career Intelligence
          </span>
        </div>
        <h1 className="font-headline-lg text-[32px] sm:text-[42px] font-extrabold text-text-primary tracking-tight max-w-3xl leading-tight">
          Find your next professional trajectory
        </h1>
        <p className="mt-space-sm text-text-secondary font-body-lg text-body-lg max-w-2xl">
          Browse the job offers published on LinQOrbit — each one structured, analyzed by AI and
          scored criterion by criterion.
        </p>

        <form
          onSubmit={search}
          className="w-full max-w-4xl mt-space-lg bg-canvas-white border border-slate-border rounded-full p-2 flex flex-col md:flex-row items-stretch md:items-center shadow-sm gap-2"
        >
          <div className="flex-1 flex items-center px-4 py-2 gap-3">
            <Icon name="search" className="text-text-tertiary text-[22px]" />
            <div className="flex-1 text-left">
              <label htmlFor="hero-search" className="sr-only">
                Job title or company
              </label>
              <input
                id="hero-search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={OFFER_SEARCH_MAX_LENGTH}
                placeholder="Job title or company"
                className="w-full bg-transparent font-headline-sm text-headline-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-primary-container hover:bg-orange-deep text-canvas-white font-label-lg text-label-lg px-space-xl py-3 rounded-full inline-flex items-center justify-center gap-2 transition-colors shrink-0"
          >
            <Icon name="arrow_forward" className="text-[20px]" />
            <span>Search jobs</span>
          </button>
        </form>
      </section>

      <section className="max-w-7xl mx-auto px-gutter py-space-md">
        <div className="relative w-full h-[360px] sm:h-[460px] rounded-xl overflow-hidden border border-slate-border shadow-sm bg-item-surface">
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(var(--color-slate-border-strong)_1px,transparent_1.5px)] bg-size-[22px_22px] [mask-image:radial-gradient(ellipse_at_center,transparent_25%,black_80%)]"
          />
          <div className="absolute inset-0 px-4 pt-4 pb-32 xl:pb-4 @container-[size] flex items-center justify-center">
            <OrbitIllustration className="shrink-0 w-[min(100cqw,150cqh)] xl:translate-x-[12%]" />
          </div>
          <div className="absolute bottom-6 left-6 right-6 sm:right-auto bg-canvas-white/95 backdrop-blur-md border border-slate-border rounded-lg p-space-md shadow-sm flex items-center gap-space-md">
            <div className="w-10 h-10 rounded-full bg-orange-subtle flex items-center justify-center text-orange-deep shrink-0">
              <Icon name="verified" className="text-[24px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-text-primary font-bold">
                  Job offers published by companies
                </span>
              </div>
              <p className="text-body-sm font-body-sm text-text-secondary mt-0.5">
                A score for every criterion, computed by the matching engine.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
