"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactValues } from "@/lib/validations/contact.schemas";
import { cn } from "@/lib/utils/cn";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";

const TEAM_SIZE_OPTIONS = [
  { value: "1-20", label: "1 - 20 employees (Seed stage)" },
  { value: "21-100", label: "21 - 100 employees (Series A-B)" },
  { value: "101-500", label: "101 - 500 employees (Scale-up)" },
  { value: "500+", label: "500+ employees (Enterprise)" },
];

type Interest = ContactValues["interests"][number];

const INTERESTS: { value: Interest; icon: string; label: string }[] = [
  { value: "enterprise-demo", icon: "visibility", label: "Enterprise Demo" },
  { value: "autonomous-sourcing", icon: "psychology", label: "Autonomous Sourcing" },
  { value: "ats-integration", icon: "sync_alt", label: "ATS Integration" },
  { value: "candidate-partnership", icon: "handshake", label: "Candidate Partnership" },
  { value: "other", icon: "tune", label: "Other" },
];

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const messageId = useId();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      workEmail: "",
      company: "",
      interests: [],
      message: "",
      consent: false,
    },
  });

  const teamSize = useWatch({ control, name: "teamSize" });
  const interests = useWatch({ control, name: "interests" }) ?? [];
  const consent = useWatch({ control, name: "consent" });

  const toggleInterest = (value: Interest) => {
    const next = interests.includes(value)
      ? interests.filter((interest) => interest !== value)
      : [...interests, value];
    setValue("interests", next);
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl p-8 sm:p-10 shadow-md">
      <div className="flex items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-border">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
            Request Platform Access
          </h2>
          <p className="font-body-md text-body-md text-text-secondary mt-1">
            Get custom benchmarks tailored to your pipeline velocity.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md shrink-0">
          <span className="w-2 h-2 rounded-full bg-orange-vibrant animate-pulse motion-reduce:animate-none" />
          <span>Fast-Track SLA</span>
        </div>
      </div>

      <form className="space-y-6" noValidate onSubmit={handleSubmit(() => setSent(true))}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="First name"
            placeholder="Alexander"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <TextField
            label="Last name"
            placeholder="Vance"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>

        <TextField
          label="Work email"
          labelAction={
            <span className="font-label-caps text-label-caps text-text-tertiary uppercase">
              Corporate Domain Preferred
            </span>
          }
          icon="alternate_email"
          type="email"
          placeholder="alexander@company.com"
          autoComplete="email"
          error={errors.workEmail?.message}
          {...register("workEmail")}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Company name"
            placeholder="Nimbus Labs"
            autoComplete="organization"
            error={errors.company?.message}
            {...register("company")}
          />
          <Select
            label="Current team size"
            options={TEAM_SIZE_OPTIONS}
            placeholder="Select size range"
            value={teamSize}
            onValueChange={(optionValue) =>
              setValue("teamSize", optionValue as ContactValues["teamSize"])
            }
            error={errors.teamSize?.message}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-label-md text-label-md text-text-secondary">
            Primary area of interest (select all that apply)
          </span>
          <div className="flex flex-wrap gap-2.5 pt-1">
            {INTERESTS.map((item) => {
              const active = interests.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleInterest(item.value)}
                  className={cn(
                    "px-4 py-2 rounded-full font-label-md text-label-md transition-all duration-150 flex items-center gap-1.5",
                    active
                      ? "bg-orange-subtle text-orange-deep"
                      : "bg-canvas-subtle text-text-secondary hover:bg-orange-subtle hover:text-orange-deep",
                  )}
                >
                  <Icon name={item.icon} className="text-[16px]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={messageId}
            className="font-label-md text-label-md text-text-secondary"
          >
            Hiring objectives &amp; context
          </label>
          <textarea
            id={messageId}
            rows={4}
            placeholder="Tell us about your upcoming roles, current bottleneck, or integration requirements..."
            aria-invalid={errors.message ? true : undefined}
            className="w-full p-4 rounded-lg bg-canvas-subtle font-body-md text-body-md text-text-primary placeholder:text-text-tertiary focus:bg-canvas-white focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
            {...register("message")}
          />
          {errors.message ? (
            <p className="font-body-sm text-body-sm text-error">{errors.message.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Checkbox
            label={
              <>
                I agree to LinQOrbit&apos;s{" "}
                <Link
                  href="/privacy"
                  className="text-text-primary hover:text-orange-deep underline font-medium"
                >
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link
                  href="/terms"
                  className="text-text-primary hover:text-orange-deep underline font-medium"
                >
                  Terms of Service
                </Link>
                . We will never sell or circulate your recruitment data.
              </>
            }
            checked={consent}
            {...register("consent")}
          />
          {errors.consent ? (
            <p className="font-body-sm text-body-sm text-error">{errors.consent.message}</p>
          ) : null}
        </div>

        <Button type="submit">
          <span>Send Message</span>
          <Icon
            name="arrow_forward"
            className="text-[20px] transition-transform group-hover:translate-x-1"
          />
        </Button>

        {sent ? (
          <Alert variant="success" title="Message sent">
            Thank you! We&apos;ll get back to you within two business days.
          </Alert>
        ) : null}
      </form>
    </div>
  );
}
