import type { Metadata } from "next";
import Link from "next/link";

import { AdminOffersSection } from "@/features/admin/admin-offers-section";

export const metadata: Metadata = {
  title: "Job offers — Administration — LinQOrbit",
  description: "Global list of every job offer in the system, for administrators.",
};

export default function AdminOffersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="pb-6 border-b border-slate-border">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-body-sm font-body-sm text-text-secondary"
        >
          <Link
            href="/admin"
            className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          >
            Administration
          </Link>
          <span aria-hidden="true" className="text-text-tertiary">
            /
          </span>
          <span className="text-text-primary font-semibold">Job offers</span>
        </nav>
        <h1 className="mt-1 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          Job offers
        </h1>
      </div>
      <AdminOffersSection />
    </div>
  );
}
