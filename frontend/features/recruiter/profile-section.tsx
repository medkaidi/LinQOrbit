"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button, CtaButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateRecruiter } from "@/hooks/use-recruiter";
import { getRecruiterErrorMessage } from "@/lib/api/recruiter.api";
import {
  updateRecruiterSchema,
  type UpdateRecruiterValues,
} from "@/lib/validations/recruiter.schemas";
import type { RecruiterProfile } from "@/types/recruiter";
import {
  OFFER_SECTION_HEADER,
  OFFER_SECTION_TITLE,
} from "@/features/job-offer/job-offer-shared";

function ReadValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-label-md text-label-md text-text-secondary">{label}</span>
      <span className="text-body-md font-body-md text-text-primary break-words">
        {value || "Not provided"}
      </span>
    </div>
  );
}

/**
 * Identité publique du recruteur (D10) : headline + bio en consultation par
 * défaut (miroir des companies), édition sur demande.
 */
export function RecruiterProfileSection({ profile }: { profile: RecruiterProfile }) {
  const update = useUpdateRecruiter();
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateRecruiterValues>({
    resolver: zodResolver(updateRecruiterSchema),
    defaultValues: {
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
    },
  });

  useEffect(() => {
    reset({ headline: profile.headline ?? "", bio: profile.bio ?? "" });
  }, [profile, reset]);

  const closeEditor = () => {
    update.reset();
    reset({ headline: profile.headline ?? "", bio: profile.bio ?? "" });
    setEditing(false);
  };

  if (!editing) {
    return (
      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className={OFFER_SECTION_HEADER}>
          <h2 className={OFFER_SECTION_TITLE}>Recruiter profile</h2>
          <Button variant="outline-sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </header>
        <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
          <ReadValue label="Headline" value={profile.headline} />
          <ReadValue label="Bio" value={profile.bio} />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={OFFER_SECTION_HEADER}>
        <h2 className={OFFER_SECTION_TITLE}>Recruiter profile</h2>
      </header>
      <form
        onSubmit={handleSubmit((values) => update.mutate(values, { onSuccess: closeEditor }))}
        className="px-6 pt-5 pb-6 flex flex-col gap-4"
        noValidate
      >
        {update.isError ? (
          <Alert variant="error" title="Could not save your profile">
            {getRecruiterErrorMessage(update.error)}
          </Alert>
        ) : null}
        <TextField
          label="Headline"
          placeholder="Talent Lead at Nimbus Labs"
          error={errors.headline?.message}
          {...register("headline")}
        />
        <Textarea
          label="Bio"
          rows={4}
          placeholder="A few words about you and your hiring focus"
          error={errors.bio?.message}
          {...register("bio")}
        />
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={closeEditor}>
            Discard
          </Button>
          <CtaButton type="submit" icon="save" busy={update.isPending} disabled={!isDirty}>
            Save changes
          </CtaButton>
        </div>
      </form>
    </section>
  );
}
