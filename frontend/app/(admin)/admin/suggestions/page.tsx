import type { Metadata } from "next";

import { AdminSuggestionsView } from "@/features/admin/admin-suggestions-section";

export const metadata: Metadata = {
  title: "Skill suggestions — Administration — LinQOrbit",
  description: "Review of the skills proposed by candidates, for administrators.",
};

export default function AdminSuggestionsPage() {
  return <AdminSuggestionsView />;
}
