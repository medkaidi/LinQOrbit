/** Lien d'action dans un `Alert` d'erreur (retry ou fermeture), partagé par la page admin et sa modale. */
export function RetryButton({ onRetry, label }: { onRetry: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="font-label-md text-label-md text-error underline underline-offset-2 cursor-pointer"
    >
      {label}
    </button>
  );
}
