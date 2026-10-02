import { PageHero } from "@/features/marketing/page-hero";

const SECTIONS = [
  {
    title: "1. Acceptance of terms",
    body: "By accessing LinQOrbit or creating an account, you agree to these terms. If you do not agree, do not use the service.",
  },
  {
    title: "2. Your account",
    body: "You agree to provide accurate information and to keep your credentials confidential. You are responsible for all activity under your account. Contact us if you suspect unauthorized access.",
  },
  {
    title: "3. Acceptable use",
    body: "You will not scrape the service at scale, interfere with its operation, misrepresent your identity or qualifications, post unlawful content, or attempt to circumvent security or access controls.",
  },
  {
    title: "4. Intellectual property",
    body: "LinQOrbit, including its branding, software and design, belongs to LinQOrbit and its licensors. You keep ownership of the content you submit and grant us the licence needed to operate the service.",
  },
  {
    title: "5. Disclaimers",
    body: "The service is provided “as is” and “as available”. We do not guarantee that matches, offers or availability will meet your expectations, or that the service will be uninterrupted or error-free.",
  },
  {
    title: "6. Limitation of liability",
    body: "To the maximum extent permitted by law, LinQOrbit is not liable for indirect, incidental or consequential damages arising from your use of the service. Nothing in these terms limits liability that cannot be limited by law.",
  },
  {
    title: "7. Changes to these terms",
    body: "We may update these terms as the product evolves. Material changes will be announced before they take effect. Continued use after that date constitutes acceptance.",
  },
  {
    title: "8. Contact",
    body: "Questions about these terms: contact@linqorbit.com.",
  },
] as const;

export function Terms() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="Legal"
        title="Terms of use"
        lede="The rules that keep LinQOrbit fair for everyone."
      />
      <section className="max-w-3xl mx-auto px-gutter pb-space-xl text-left space-y-space-md">
        <p className="text-body-sm font-body-sm text-text-tertiary">
          Last updated: October 2026. These terms govern your use of the LinQOrbit platform.
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
