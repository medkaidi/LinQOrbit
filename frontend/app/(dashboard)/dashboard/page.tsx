import type { Metadata } from "next";

import { DashboardOverview } from "@/features/auth/dashboard-overview";

export const metadata: Metadata = {
  title: "Dashboard — LinQOrbit",
  description: "Overview of your recruiting pipelines and AI agents.",
};

export default function DashboardPage() {
  return <DashboardOverview />;
}
