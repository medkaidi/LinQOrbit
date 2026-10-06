"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useViewModeStore, type ViewMode } from "@/stores/view-mode-store";

export function ViewModeToggle() {
  const mode = useViewModeStore((state) => state.mode);
  const setMode = useViewModeStore((state) => state.setMode);

  return (
    <SegmentedControl<ViewMode>
      label="Profile mode"
      value={mode}
      options={[
        { value: "candidate", label: "Candidate" },
        { value: "recruiter", label: "Recruiter" },
      ]}
      onChange={setMode}
      className="max-md:hidden"
    />
  );
}
