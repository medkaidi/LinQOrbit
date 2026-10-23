"use client";

import { useEffect, useRef } from "react";

import { StatusStreamError } from "@/lib/api/status-stream";

/** Délai avant de rouvrir un flux fermé par le serveur (timeout) ou coupé par le réseau. */
const RECONNECT_DELAY_MS = 1_000;
/**
 * Reconnexions après la tentative initiale, sur échecs réseau ou serveur
 * consécutifs, avant d'abandonner l'écoute : 1 + 5 ouvertures au plus
 * (compteur remis à zéro à chaque événement).
 */
const MAX_NETWORK_RETRIES = 5;

/** Refus du serveur (4xx : accès fermé, ressource absente…) : définitif, inutile de réessayer. */
function isRefusal(error: unknown): boolean {
  return error instanceof StatusStreamError && error.status < 500;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

type StatusStreamOptions<T> = {
  /** N'ouvre le flux que pendant une analyse. */
  active: boolean;
  /**
   * Identité de la ressource suivie (`candidate`, `offer:<id>`, `<publicId>`) :
   * un changement ferme le flux précédent et en ouvre un seul nouveau.
   */
  streamKey: string;
  /** Ouvre le flux SSE ; les transitions sont des signaux, pas la vérité affichée. */
  stream: (onStatus: (event: T) => void, signal: AbortSignal) => Promise<void>;
  /** Dernier statut : coupe l'écoute, aucune réouverture. */
  isTerminal: (event: T) => boolean;
  /** Relit la ressource (le GET reste la source de vérité) à chaque signal et après échec. */
  refresh: () => void | Promise<unknown>;
};

/**
 * Push SSE générique (normalisation D64, matching D60) : **un** flux par
 * ressource, ouvert seulement pendant une analyse. Chaque événement invalide
 * la ressource ; un statut terminal arrête l'écoute, un flux fermé par le
 * serveur alors que l'analyse continue (timeout 120 s) est rouvert, l'écoute
 * est coupée au démontage. Après tout échec, la ressource est relue ; un refus
 * (4xx) arrête l'écoute, une coupure réseau ou une erreur serveur la reprend
 * après {@link RECONNECT_DELAY_MS}, au plus {@link MAX_NETWORK_RETRIES} fois.
 *
 * <p>Les callbacks passent par des refs : seule l'identité de la ressource
 * (`active`, `streamKey`) relance l'effet — un rendu ne rouvre jamais le flux.</p>
 */
export function useStatusStream<T>({
  active,
  streamKey,
  stream,
  isTerminal,
  refresh,
}: StatusStreamOptions<T>) {
  const streamRef = useRef(stream);
  const isTerminalRef = useRef(isTerminal);
  const refreshRef = useRef(refresh);

  // Les callbacks sont synchronisés après le rendu, jamais pendant : l'effet
  // de flux (déclaré ensuite) les voit déjà à jour et ne dépend que de la
  // ressource. Un rendu ne rouvre donc jamais le flux.
  useEffect(() => {
    streamRef.current = stream;
    isTerminalRef.current = isTerminal;
    refreshRef.current = refresh;
  }, [stream, isTerminal, refresh]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const controller = new AbortController();
    const refreshResource = () => {
      void refreshRef.current();
    };

    const listen = async () => {
      let finished = false;
      let failures = 0;
      while (!controller.signal.aborted && !finished) {
        try {
          await streamRef.current(
            (event) => {
              failures = 0;
              finished = isTerminalRef.current(event);
              refreshResource();
            },
            controller.signal,
          );
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          refreshResource();
          failures += 1;
          if (isRefusal(error) || failures > MAX_NETWORK_RETRIES) {
            return;
          }
        }
        if (!finished) {
          await wait(RECONNECT_DELAY_MS, controller.signal);
        }
      }
    };
    void listen();

    return () => controller.abort();
  }, [active, streamKey]);
}
