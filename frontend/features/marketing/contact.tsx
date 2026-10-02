import { Icon } from "@/components/ui/icon";
import { PageHero } from "@/features/marketing/page-hero";

export function Contact() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="Contact"
        title="Talk to us"
        lede="Questions, feedback or partnerships — we usually reply within two business days."
      />
      <section className="max-w-3xl mx-auto px-gutter pb-space-xl grid grid-cols-1 sm:grid-cols-2 gap-space-md">
        <article className="bg-surface-container-low p-space-md rounded-lg border border-slate-border flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-full bg-orange-subtle flex items-center justify-center text-orange-deep shrink-0">
            <Icon name="mail" className="text-[22px]" />
          </div>
          <div className="text-left">
            <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">
              Email us
            </h2>
            <a
              href="mailto:contact@linqorbit.com"
              className="mt-0.5 inline-block text-body-sm font-body-sm text-primary-container hover:text-orange-deep transition-colors"
            >
              contact@linqorbit.com
            </a>
          </div>
        </article>
        <article className="bg-surface-container-low p-space-md rounded-lg border border-slate-border flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-full bg-orange-subtle flex items-center justify-center text-orange-deep shrink-0">
            <Icon name="schedule" className="text-[22px]" />
          </div>
          <div className="text-left">
            <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">
              Response time
            </h2>
            <p className="mt-0.5 text-body-sm font-body-sm text-text-secondary">
              Within two business days.
            </p>
          </div>
        </article>
      </section>
      <section className="max-w-3xl mx-auto px-gutter pb-space-xl text-left">
        <p className="text-body-sm font-body-sm text-text-tertiary">
          Please include the email address of your account if you already have one — it helps us
          find you faster.
        </p>
      </section>
    </div>
  );
}
