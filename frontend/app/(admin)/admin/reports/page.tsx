import type { Metadata } from "next";

import { AdminReportsSection } from "@/features/admin/admin-reports-section";

export const metadata: Metadata = {
  title: "AI reports — Administration — LinQOrbit",
  description:
    "Internal reports raised by recruiters on the AI assessment of an application, for administrators.",
};

export default function AdminReportsPage() {
  return <AdminReportsSection />;
}
