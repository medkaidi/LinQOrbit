"use client";

import { useEffect, useState } from "react";

import { CtaButton } from "@/components/ui/button";
import { publicJobPath } from "@/features/job-offer/job-offer-shared";

/**
 * Copie l'URL publique absolue dans le presse-papiers, avec retour visuel
 * « Copied » (2 s). `basePath` distingue la fiche du board authentifié
 * (`/jobs`) de celle de la vitrine publique (`/public/jobs`, D100/T-113).
 *
 * `basePath` est **obligatoire** : les deux bases mènent à deux coquilles
 * différentes (shell dashboard vs shell public), et l'oublier ouvrait ou
 * copiait la fiche **authentifiée** là où il fallait la page **publique**.
 */
export function CopyPublicLinkButton({
  publicId,
  slug,
  basePath,
}: {
  publicId: string;
  slug: string;
  /** Base de l'URL copiée : `/public/jobs` (vitrine) ou `/jobs` (board authentifié). */
  basePath: string;
}) {
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
        const url = new URL(
          publicJobPath(publicId, slug, basePath),
          window.location.origin,
        ).toString();
        void navigator.clipboard.writeText(url).then(() => setCopied(true));
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </CtaButton>
  );
}
