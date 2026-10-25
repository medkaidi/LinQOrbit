import type { Metadata } from "next";

import { AdminOverview } from "@/features/admin/admin-overview";

export const metadata: Metadata = {
  title: "Administration — LinQOrbit",
  description: "Platform overview for administrators: accounts, offers, applications and moderation queues.",
};

export default function AdminPage() {
  return <AdminOverview />;
}
