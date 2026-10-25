import type { Metadata } from "next";

import { DashboardOverview } from "@/features/auth/dashboard-overview";

export const metadata: Metadata = {
  title: "Dashboard — LinQOrbit",
  description: "Your LinQOrbit overview: activity, applications and next steps.",
};

export default function DashboardPage() {
  return <DashboardOverview />;
}
