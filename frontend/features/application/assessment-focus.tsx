"use client";

import { Alert } from "@/components/ui/alert";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { Spinner } from "@/components/ui/spinner";
import { ClarificationPanel } from "@/features/matching/clarification-panel";
import { useCurrentMatching } from "@/hooks/use-matching";
import { getApiErrorMessage } from "@/lib/utils/api-error";

/**
 * Contenu central de l'étape « Dynamic Candidate Assessment » quand l'évaluation est
 * ouverte (`assessmentOpen`, D6) : un chargement pendant l'analyse, la
 * question IA (ou la clôture à demander) une fois l'analyse terminée. La
 * transmission est masquée tant que ce contenu est affiché — le candidat agit
 * d'abord sur son évaluation. Le panneau « Your match » garde les scores.
 */
export function AssessmentFocus({ publicId }: { publicId: string }) {
  const matching = useCurrentMatching(publicId);
  const status = matching.data?.status;

  if (matching.isLoading || status === "pending" || status === "running") {
    return (
      <section aria-label="Assessment in progress" className={SECTION_CARD_CLASS}>
        <header className={SECTION_HEADER_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Your assessment</h2>
        </header>
        <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
          <Spinner />
          <p className="text-body-md font-body-md font-semibold text-text-primary">
            Analyzing your application…
          </p>
          <p className={MUTED_TEXT_CLASS}>
            Your profile is being compared with this offer. It usually takes less than a minute —
            this step updates automatically.
          </p>
        </div>
      </section>
    );
  }

  if (status === "failed") {
    return (
      <section aria-label="Assessment failed" className={SECTION_CARD_CLASS}>
        <header className={SECTION_HEADER_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Your assessment</h2>
        </header>
        <div className="px-6 pt-5 pb-6">
          <Alert variant="error" title="The analysis failed">
            Your match could not be computed. Run it again from “Your match” to continue your
            assessment.
          </Alert>
        </div>
      </section>
    );
  }

  if (matching.isError || !matching.data) {
    return (
      <section aria-label="Assessment unavailable" className={SECTION_CARD_CLASS}>
        <div className="p-6">
          <Alert variant="error" title="Could not load your assessment">
            {matching.isError
              ? getApiErrorMessage(matching.error)
              : "Your assessment is not available yet."}
          </Alert>
        </div>
      </section>
    );
  }

  return <ClarificationPanel publicId={publicId} matching={matching.data} />;
}
