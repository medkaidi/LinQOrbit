"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { useMounted } from "@/hooks/use-mounted";
import { useAuthStore } from "@/stores/auth-store";

const TABS = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const mounted = useMounted();
  // La session n'est lue qu'après l'hydratation : le jeton vit dans un store
  // persisté, le HTML prérendu ne le connaît pas — le lire au premier
  // rendu créerait une divergence d'hydratation.
  const signedIn = mounted && Boolean(token);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-canvas-white/95 backdrop-blur-md border-b border-slate-border">
      <div className="h-16 max-w-7xl mx-auto px-gutter flex items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-xl">
          <Link href="/" className="flex items-center gap-space-sm group focus:outline-none">
            <Logo className="h-6 w-auto object-contain" strokeScale={1.75} />
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
                  className={`h-full inline-flex items-center transition-colors px-space-xs font-label-lg text-label-lg tracking-tight ${
                    isActive
                      ? "text-slate-ink font-semibold border-b-[1.5px] border-primary-container"
                      : "text-text-secondary hover:text-slate-ink font-medium"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-space-md">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="font-label-lg text-label-lg text-text-secondary hover:text-slate-ink font-medium tracking-tight transition-colors px-space-sm py-2"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="font-label-lg text-label-lg text-text-secondary hover:text-slate-ink font-medium tracking-tight transition-colors px-space-sm py-2"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="bg-primary-container hover:bg-orange-deep text-canvas-white font-label-lg text-label-lg px-5 py-2 rounded-full inline-flex items-center gap-2 transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
