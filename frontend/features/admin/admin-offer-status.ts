import type { BadgeTone } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/features/job-offer/job-offer-shared";
import type { AdminJobOfferStatus } from "@/types/admin";

/** Tones du badge statut dans la console admin (D33) — source unique (TD-027). */
export const ADMIN_OFFER_STATUS_TONES: Record<AdminJobOfferStatus, BadgeTone> = {
  draft: "neutral",
  validated: "neutral",
  published: "success",
  closed: "neutral",
};

/** Libellés partagés avec le dashboard recruteur (même table de vérité). */
export function adminOfferStatusLabel(status: AdminJobOfferStatus): string {
  return STATUS_LABELS[status];
}
