import type { Metadata } from "next";

import { AdminOffersSection } from "@/features/admin/admin-offers-section";

export const metadata: Metadata = {
  title: "Job offers — Administration — LinQOrbit",
  description: "Global list of every job offer in the system, for administrators.",
};

export default function AdminOffersPage() {
  return <AdminOffersSection />;
}
