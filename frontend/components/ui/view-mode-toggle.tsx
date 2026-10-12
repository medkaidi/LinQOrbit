"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { ViewModeSwitchDialog } from "@/components/ui/view-mode-switch-dialog";
import { useViewMode } from "@/hooks/use-view-mode";
import type { ViewMode } from "@/stores/view-mode-store";

/**
 * Bascule Candidate | Recruiter : le segment actif suit le profil sélectionné
 * (store, ré-syncé par la route `/recruiter*`). Le passage vers le profil
 * recruteur demande d'abord la confirmation (message de l'essai, sans
 * navigation) ; le retour au profil candidat navigue directement.
 */
export function ViewModeToggle() {
  const router = useRouter();
  const { mode, setMode } = useViewMode();
  const [switching, setSwitching] = useState(false);

  const goTo = (next: ViewMode) => {
    setMode(next);
    router.push(next === "recruiter" ? "/recruiter" : "/dashboard");
  };

  return (
    <>
      <SegmentedControl<ViewMode>
        label="Profile mode"
        value={mode}
        options={[
          { value: "candidate", label: "Candidate" },
          { value: "recruiter", label: "Recruiter" },
        ]}
        onChange={(next) => {
          if (next === "candidate") {
            goTo("candidate");
          } else if (mode === "candidate") {
            setSwitching(true);
          }
        }}
        className="max-md:hidden"
      />
      {switching ? (
        <ViewModeSwitchDialog
          onConfirm={() => {
            setSwitching(false);
            goTo("recruiter");
          }}
          onCancel={() => setSwitching(false)}
        />
      ) : null}
    </>
  );
}
