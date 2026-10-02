import { PageHero } from "@/features/marketing/page-hero";

const SECTIONS = [
  {
    title: "Information we collect",
    body: "Account information you provide (name, email address, authentication credentials), profile content you choose to add, and basic usage data needed to operate and secure the service (log entries, device and browser metadata).",
  },
  {
    title: "How we use it",
    body: "To provide and improve the platform, personalize your matches, secure your account, and communicate with you about the service. We do not use your data to build advertising profiles for third parties.",
  },
  {
    title: "Sharing and disclosure",
    body: "We never sell your personal data. We share it only with service providers strictly necessary to run LinQOrbit (hosting, email, analytics), bound by their own obligations, or when the law requires it.",
  },
  {
    title: "Retention",
    body: "We keep personal data only as long as your account is active or as needed to meet legal obligations. You can request deletion at any time (see below).",
  },
  {
    title: "Your rights",
    body: "You may request access to, correction of, or deletion of your personal data, and object to or restrict certain processing. Write to us and we will respond within the legally required timeframe.",
  },
  {
    title: "Contact us",
    body: "For any privacy question: contact@linqorbit.com. We treat data requests with the same two-business-day response target as the rest of our support.",
  },
] as const;

export function Privacy() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="Legal"
        title="Privacy notice"
        lede="Your data stays yours — here is exactly how we handle it."
      />
      <section className="max-w-3xl mx-auto px-gutter pb-space-xl text-left space-y-space-md">
        <p className="text-body-sm font-body-sm text-text-tertiary">
          Last updated: October 2026. This notice describes how LinQOrbit handles personal data
          when you use this website and create an account.
        </p>
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">
              {section.title}
            </h2>
            <p className="mt-1 text-body-md font-body-md text-text-secondary leading-relaxed">
              {section.body}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
