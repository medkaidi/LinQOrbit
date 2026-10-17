"use client";

import { useEffect, useState } from "react";

import { CtaButton } from "@/components/ui/button";
import { publicJobPath } from "@/features/job-offer/job-offer-shared";

/** Copie l'URL publique absolue dans le presse-papiers, avec retour visuel « Copied » (2 s). */
export function CopyPublicLinkButton({ publicId, slug }: { publicId: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <CtaButton
      tone="neutral"
      icon={copied ? "check" : "content_copy"}
      aria-label={copied ? "Link copied" : "Copy link"}
      onClick={() => {
        const url = new URL(publicJobPath(publicId, slug), window.location.origin).toString();
        void navigator.clipboard.writeText(url).then(() => setCopied(true));
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </CtaButton>
  );
}
