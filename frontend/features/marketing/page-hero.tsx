import type { ReactNode } from "react";

export type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  actions?: ReactNode;
};

export function PageHero({ eyebrow, title, lede, actions }: PageHeroProps) {
  return (
    <section className="max-w-7xl mx-auto px-gutter pt-space-xl pb-space-md flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-subtle shadow-sm mb-6">
        <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse motion-reduce:animate-none" />
        <span className="font-label-caps text-label-caps text-orange-deep tracking-widest uppercase">
          {eyebrow}
        </span>
      </div>
      <h1 className="font-display text-display-mobile sm:text-display text-text-primary tracking-tight max-w-4xl mx-auto">
        {title}
      </h1>
      <p className="mt-4 text-text-secondary font-body-lg text-body-lg max-w-2xl mx-auto">{lede}</p>
      {actions ? (
        <div className="flex flex-wrap items-center justify-center gap-4 pt-8">{actions}</div>
      ) : null}
    </section>
  );
}
