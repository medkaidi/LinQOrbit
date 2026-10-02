import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";

const SUGGESTIONS = ["Tech & Dev", "Product Design", "AI Engineering", "Data", "Fully remote"];

export function MarketingHome() {
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
          Thousands of high-impact opportunities, continuously analyzed by your AI agents.
        </p>

        <div className="w-full max-w-4xl mt-space-lg bg-canvas-white border border-slate-border rounded-full p-2 flex flex-col md:flex-row items-stretch md:items-center shadow-sm gap-2">
          <div className="flex-1 flex items-center px-4 py-2 gap-3">
            <Icon name="search" className="text-text-tertiary text-[22px]" />
            <div className="flex-1 text-left">
              <label htmlFor="hero-search-role" className="sr-only">
                Role, skill or keyword
              </label>
              <input
                id="hero-search-role"
                type="text"
                placeholder="Job title, skills, stack..."
                className="w-full bg-transparent font-headline-sm text-headline-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
          </div>
          <div className="hidden md:block w-px h-8 bg-slate-border my-auto" />
          <div className="flex-1 flex items-center px-4 py-2 gap-3">
            <Icon name="location_on" className="text-text-tertiary text-[22px]" />
            <div className="flex-1 text-left">
              <label htmlFor="hero-search-loc" className="sr-only">
                City, region or remote
              </label>
              <input
                id="hero-search-loc"
                type="text"
                placeholder="City, region or remote"
                className="w-full bg-transparent font-headline-sm text-headline-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
          </div>
          <Link
            href="/signup"
            className="bg-primary-container hover:bg-orange-deep text-canvas-white font-label-lg text-label-lg px-space-xl py-3 rounded-full inline-flex items-center justify-center gap-2 transition-colors shrink-0"
          >
            <Icon name="arrow_forward" className="text-[20px]" />
            <span>Search jobs</span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-space-md">
          <span className="font-label-md text-label-md text-text-tertiary mr-1">Suggestions:</span>
          {SUGGESTIONS.map((suggestion) => (
            <span
              key={suggestion}
              className="px-3 py-1 rounded-full bg-surface-container-low text-text-secondary text-body-sm font-body-sm"
            >
              {suggestion}
            </span>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-gutter py-space-md">
        <div className="relative w-full h-[360px] sm:h-[460px] rounded-xl overflow-hidden border border-slate-border shadow-sm">
          <Image
            src="/images/home-workspace.png"
            alt="Bright modern workspace for a tech recruitment platform"
            fill
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
          />
          <div className="absolute bottom-6 left-6 right-6 sm:right-auto bg-canvas-white/95 backdrop-blur-md border border-slate-border rounded-lg p-space-md shadow-sm flex items-center gap-space-md">
            <div className="w-10 h-10 rounded-full bg-orange-subtle flex items-center justify-center text-orange-deep shrink-0">
              <Icon name="verified" className="text-[24px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-text-primary font-bold">
                  Verified opportunities, refreshed weekly
                </span>
              </div>
              <p className="text-body-sm font-body-sm text-text-secondary mt-0.5">
                Real-time match scoring by your AI agents.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
