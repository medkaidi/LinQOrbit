import type { Metadata } from "next";

import { AdminGate } from "@/features/admin/admin-gate";
import { AdminView } from "@/features/admin/admin-page";

export const metadata: Metadata = {
  title: "Administration — LinQOrbit",
  description: "Accounts and skill suggestion review for administrators.",
};

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminView />
    </AdminGate>
  );
}
