import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/icon";
import { PageHero } from "@/features/marketing/page-hero";
import { ContactForm } from "@/features/marketing/contact-form";

const CHANNELS = [
  {
    icon: "corporate_fare",
    title: "Sales & Enterprise Demos",
    body: "Tailored architecture, private clouds & multi-seat SLAs",
    email: "sales@linqorbit.com",
    primary: true,
  },
  {
    icon: "support_agent",
    title: "Candidate & General Inquiries",
    body: "Candidate profiles, career questions & account support",
    email: "contact@linqorbit.com",
    primary: false,
  },
  {
    icon: "campaign",
    title: "Press & Media Relations",
    body: "Keynotes, platform research & brand assets",
    email: "press@linqorbit.com",
    primary: false,
  },
] as const;

export function Contact() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="Get in touch"
        title="Let's Connect and Propel Your Recruitment"
        lede="Whether you are looking to scale your engineering team or want a tailored enterprise demo of our autonomous AI agents, our specialists are here to assist."
      />

      <section className="max-w-7xl mx-auto px-gutter pb-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-surface-container-lowest rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
              <h2 className="font-headline-md text-headline-md text-text-primary tracking-tight">
                Direct Channels
              </h2>
              <div className="space-y-5">
                {CHANNELS.map((channel) => (
                  <div key={channel.email} className="flex items-start gap-4 group">
                    <span
                      className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors",
                        channel.primary
                          ? "bg-orange-subtle text-primary-container group-hover:bg-primary-container group-hover:text-canvas-white"
                          : "bg-surface-container-low text-secondary group-hover:bg-text-primary group-hover:text-canvas-white",
                      )}
                    >
                      <Icon name={channel.icon} className="text-[20px]" />
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-label-lg text-label-lg text-text-primary">
                        {channel.title}
                      </p>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        {channel.body}
                      </p>
                      <div className="pt-1">
                        <a
                          href={`mailto:${channel.email}`}
                          className="font-label-md text-label-md text-orange-deep hover:underline flex items-center gap-1"
                        >
                          {channel.email}
                          <Icon name="arrow_outward" className="text-[14px]" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-headline-md text-headline-md text-text-primary tracking-tight">
                  Global Hubs
                </h2>
                <span className="font-label-caps text-label-caps uppercase text-text-tertiary">
                  Headquarters
                </span>
              </div>
              <div className="bg-canvas-subtle rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label-lg text-label-lg text-text-primary">Paris HQ</span>
                  <span className="font-label-caps text-label-caps text-orange-deep bg-orange-subtle px-2 py-0.5 rounded-full">
                    CENTRAL
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-text-secondary">
                  12 Rue de la Paix, 75002 Paris, France
                </p>
                <p className="font-body-sm text-body-sm text-text-tertiary flex items-center gap-1">
                  <Icon name="schedule" className="text-[14px]" />
                  <span>9:00 - 18:30 CET</span>
                </p>
              </div>
              <div className="bg-surface-container rounded-lg p-4 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-text-primary min-w-0">
                  <Icon name="pin_drop" className="text-primary-container text-[20px] shrink-0" />
                  <span className="font-label-md text-label-md truncate">Paris, France</span>
                </span>
                <span className="font-label-caps text-label-caps tracking-wider text-text-secondary shrink-0">
                  LAT 48.8698&deg; N
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <ContactForm />
          </div>
        </div>
      </section>
    </div>
  );
}
