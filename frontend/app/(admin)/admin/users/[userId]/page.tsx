import type { Metadata } from "next";

import { UserDetailView } from "@/features/admin/user-detail-view";

export const metadata: Metadata = {
  title: "Account — Administration — LinQOrbit",
  description: "Account details and normalized profile for administrators.",
};

export default async function AdminUserPage({
  params,
}: PageProps<"/admin/users/[userId]">) {
  const { userId } = await params;
  return <UserDetailView userId={userId} />;
}
