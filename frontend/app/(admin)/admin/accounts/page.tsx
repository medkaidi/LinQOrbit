import type { Metadata } from "next";

import { AdminView } from "@/features/admin/admin-page";

export const metadata: Metadata = {
  title: "Accounts — Administration — LinQOrbit",
  description: "Accounts and skill suggestion review for administrators.",
};

export default function AdminAccountsPage() {
  return <AdminView />;
}
