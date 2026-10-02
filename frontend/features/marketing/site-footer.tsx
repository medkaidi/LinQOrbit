import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

const FOOTER_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Help & Support", href: "/contact" },
  { label: "Recruiters", href: null },
] as const;

export function SiteFooter() {
  return (
    <footer className="w-full bg-canvas-white border-t border-slate-border py-space-xl">
      <div className="max-w-7xl mx-auto px-gutter">
        <div className="flex flex-col md:flex-row items-center justify-between gap-space-md text-center md:text-left">
          <div className="flex items-center gap-space-sm">
            <Wordmark className="h-5 w-auto" />
            <span className="font-body-sm text-body-sm text-text-tertiary">
              · Talent &amp; opportunity discovery engine
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-space-lg">
            {FOOTER_LINKS.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="font-body-sm text-body-sm text-text-secondary hover:text-orange-deep transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span key={item.label} className="font-body-sm text-body-sm text-text-secondary">
                  {item.label}
                </span>
              ),
            )}
          </div>
          <div className="font-body-sm text-body-sm text-text-tertiary">
            © 2025 LinQOrbit Inc. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
