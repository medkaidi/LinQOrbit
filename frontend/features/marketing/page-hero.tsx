export type PageHeroProps = {
  eyebrow: string;
  title: string;
  lede: string;
};

export function PageHero({ eyebrow, title, lede }: PageHeroProps) {
  return (
    <section className="max-w-7xl mx-auto px-gutter pt-space-xl pb-space-md flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-subtle border border-orange-subtle mb-space-sm">
        <span className="w-2 h-2 rounded-full bg-orange-vibrant animate-pulse motion-reduce:animate-none" />
        <span className="font-label-md text-label-md text-orange-deep font-semibold tracking-wide uppercase">
          {eyebrow}
        </span>
      </div>
      <h1 className="font-headline-lg text-[32px] sm:text-[42px] font-extrabold text-text-primary tracking-tight max-w-3xl leading-tight">
        {title}
      </h1>
      <p className="mt-space-sm text-text-secondary font-body-lg text-body-lg max-w-2xl">{lede}</p>
    </section>
  );
}
