"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

export type FaqItem = {
  icon: string;
  question: string;
  answer: string;
};

export type FaqExplorerProps = {
  faqs: readonly FaqItem[];
};

export function FaqExplorer({ faqs }: FaqExplorerProps) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? faqs.filter(
        (item) =>
          item.question.toLowerCase().includes(normalized) ||
          item.answer.toLowerCase().includes(normalized),
      )
    : faqs;

  return (
    <>
      <div className="max-w-xl mx-auto px-gutter pt-2">
        <div className="relative flex items-center bg-canvas-white shadow-sm rounded-full px-5 py-2.5 transition-all focus-within:shadow-md">
          <Icon name="search" className="text-text-tertiary mr-3 text-[22px]" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keywords (e.g. agents, matching, launch)..."
            aria-label="Search frequently asked questions"
            className="w-full bg-transparent font-body-md text-body-md text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="text-text-tertiary hover:text-text-primary transition-colors shrink-0"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          ) : null}
        </div>
      </div>

      <section className="max-w-4xl mx-auto w-full px-gutter py-6">
        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((item) => (
              <details
                key={item.question}
                className="group bg-canvas-white rounded-xl shadow-sm overflow-hidden"
              >
                <summary className="px-6 py-5 flex items-start justify-between gap-4 text-left cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-3.5 pr-2 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-orange-subtle text-orange-deep flex items-center justify-center shrink-0">
                      <Icon name={item.icon} className="text-[18px]" />
                    </span>
                    <span className="font-headline-sm text-headline-sm text-text-primary group-hover:text-orange-deep transition-colors">
                      {item.question}
                    </span>
                  </span>
                  <span className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-text-secondary shrink-0 transition-transform group-open:rotate-180">
                    <Icon name="expand_more" className="text-[20px]" />
                  </span>
                </summary>
                <div className="px-6 pb-6 pt-1 text-text-secondary font-body-md text-body-md leading-relaxed">
                  <p>{item.answer}</p>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-canvas-subtle rounded-xl">
            <Icon name="search_off" className="text-[48px] text-text-tertiary" />
            <h3 className="mt-3 font-headline-sm text-headline-sm text-text-primary">
              No matching questions found
            </h3>
            <p className="mt-1 font-body-md text-body-md text-text-secondary max-w-sm mx-auto">
              Try adjusting your keywords, or reach out from the Contact page.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-4 px-5 py-2 rounded-full bg-primary-container text-canvas-white font-label-md text-label-md hover:bg-orange-deep transition-all"
            >
              Reset search
            </button>
          </div>
        )}
      </section>
    </>
  );
}
