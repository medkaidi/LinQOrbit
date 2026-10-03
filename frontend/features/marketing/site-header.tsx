"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";

const TABS = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-canvas-white/95 backdrop-blur-md border-b border-slate-border">
      <div className="h-16 max-w-7xl mx-auto px-gutter flex items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-xl">
          <Link href="/" className="flex items-center gap-space-sm group focus:outline-none">
            <Logo className="h-6 w-auto object-contain" strokeScale={2} />
            <Wordmark className="h-6 w-auto hidden sm:block" />
          </Link>
          <nav className="hidden md:flex items-center gap-space-lg h-16" aria-label="Main">
            {TABS.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`h-full inline-flex items-center transition-colors px-space-xs font-label-lg text-label-lg ${
                    isActive
                      ? "text-text-primary font-bold border-b-2 border-primary-container"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-space-md">
          <Link
            href="/login"
            className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors px-space-sm py-2"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-primary-container hover:bg-orange-deep text-canvas-white font-label-lg text-label-lg px-5 py-2 rounded-full inline-flex items-center gap-2 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
